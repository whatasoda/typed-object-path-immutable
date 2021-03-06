const immutable = <T>(value: T) => new Immutable(value);
export default immutable;

class Immutable<T> {
    public closed: boolean = false;
    protected clones = new Set<any>();
    protected value: T;
    constructor(value: T) {
        this.value = cloneValue(this.clones, value);
    }

    public set<P extends string, S extends R[2], R extends ResolveObjectPath<T, P, S>>(
        path: P | R[1],
        substitutions: S,
        value: R[0],
    ): this {
        assertActive(this);
        return this.change<R[3]>(path, substitutions, (v, k) => {
            v[k] = value;
        });
    }

    public delete<P extends string, S extends R[2], R extends ResolveObjectPath<T, P, S>>(
        path: P | R[1],
        substitutions: S,
    ): this {
        assertActive(this);
        type E = undefined extends R[0] ? '' : 'cannot delete non-nullable path';
        return this.change<R[3], E>(path, substitutions, (v, k) => {
            delete v[k];
        });
    }

    public ensure<P extends string, S extends R[2], R extends ResolveObjectPath<T, P, S>>(
        path: P | R[1],
        substitutions: S,
        createValue: () => NonNullable<R[0]>,
    ): this {
        assertActive(this);
        return this.change<R[3]>(path, substitutions, (v, k) => {
            if (v[k] == null) {
                v[k] = createValue();
            }
        });
    }

    public drop<P extends string, S extends R[2], R extends ResolveObjectPath<T, P, S>>(
        path: P | R[1],
        substitutions: S,
        start: number,
        end?: number,
    ): this {
        assertActive(this);
        type E = R[0] extends any[] ? '' : 'cannot drop from non-array value';
        return this.change<R[3], E>(path, substitutions, (v, k) => {
            const arr = (v[k] as any[]);
            if (end == null) {
                v[k] = arr.slice(0, start);
            } else if (start === 0) {
                v[k] = arr.slice(end);
            } else {
                start = start < 0 ? arr.length + start : start;
                end = Math.max(end < 0 ? arr.length + end : end, start);
                v[k] = [...arr.slice(0, start), ...arr.slice(end)];
            }
        });
    }

    public insert<P extends string, S extends R[2], R extends ResolveObjectPath<T, P, S>>(
        path: P | R[1],
        substitutions: S,
        index: number | null,
        items: R[0] extends (infer T)[] ? T[] : never,
    ): this {
        assertActive(this);
        type E = R[0] extends any[] ? '' : 'cannot insert items to non-array value';
        return this.change<R[3], E>(path, substitutions, (v, k) => {
            const arr = (v[k] as any[]);
            if (index == null || index >= arr.length) {
                v[k] = [...arr, ...items];
            } else if (index === 0) {
                v[k] = [...items, ...arr];
            } else {
                v[k] = [...arr.slice(0, index), ...items, ...arr.slice(index)];
            }
        });
    }

    public close(): T {
        this.clones.clear();
        this.closed = true;
        return this.value;
    }

    protected change<R3 extends string, E extends string = ''>(
        path: string,
        substitutions: readonly KeyLike[],
        callback: (value: any, lastFragment: KeyLike) => void,
    ): R3 extends '' ? E extends '' ? this : never : never {
        const s = substitutions.slice();
        const fragments = getFragments(path);
        if (fragments.count < substitutions.length) {
            throw new Error(
                `${fragments.count} substitutions expected for path '${path}' but received ${substitutions.length}`,
            );
        }

        let depth = 0;
        let curr: any = this.value;
        const { length } = fragments;
        for (let fragment of fragments) {
            if (fragment === '{}') {
                fragment = s.shift()!;
            }

            if (++depth < length) {
                curr = curr[fragment] = cloneValue(this.clones, curr[fragment]);
            } else {
                callback(curr, fragment);
            }
        }
        return this as R3 extends '' ? E extends '' ? this : never : never; // TODO: use throw type
    }
}

const assertActive = (immutable: Immutable<any>) => {
    if (immutable.closed) {
        throw new Error('cannot make changes to closed instance of Immutable');
    }
};

const hasOwnProperty = Object.prototype.hasOwnProperty;
const assign = (target: any, source: any) => {
    for (var key in source) {
        if (hasOwnProperty.call(source, key)) {
            target[key] = source[key];
        }
    }
    return target;
};

const cloneValue = (clones: Set<any>, value: any) => {
    if (value == null) {
        throw new Error("cannot clone nullish value: use 'Immutable.ensure' in advance");
    } else if (typeof value !== 'object' || clones.has(value)) {
        return value;
    } else {
        const clone = Array.isArray(value) ? value.slice() : assign({}, value);
        clones.add(clone);
        return clone;
    }
};

interface Fragments extends Array<KeyLike> {
    /** Substitution Count */
    count: number;
}
const FragmentsCache = new Map<string, Fragments>();
const getFragments = (path: string): Fragments => {
    const cache = FragmentsCache.get(path);
    if (cache) {
        return cache;
    } else {
        const fragments: Fragments = assign([], { count: 0 });
        path.split('.').forEach((fragment) => {
            if (fragment === '{}') {
                fragments.count++;
            }
            const n = Number(fragment);
            fragments.push(n === n /* (NaN === NaN) === false */ ? n : fragment);
        });
        FragmentsCache.set(path, fragments);
        return fragments;
    }
};

// https://stackoverflow.com/questions/50374908/transform-union-type-to-intersection-type#answer-50375286
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

type KeyLike = string | number;

declare const BREAK: unique symbol;
type Break<T> = [typeof BREAK, T];

declare const THROUGH: unique symbol;
type Through = typeof THROUGH;

type Unreachable = never;

type RR<K extends string | number, T> = Readonly<Record<K, T>>;

// prettier-ignore
type TrimDots<T extends string> =
    T extends `.${infer U}`
        ? TrimDots<U>
    : T extends `${infer U}.`
        ? TrimDots<U>
    : T;

type ResolveObjectPath<T, P extends string, S extends readonly any[]> = _ResolveObjectPath<[P, S], T, P, S, '', readonly []>;
// prettier-ignore
type _ResolveObjectPath<
    Original extends [path: string, substitution: readonly any[]],
    T,
    Path extends string,
    Substitutions extends readonly any[],
    ResolvedPath extends string,
    ResolvedSubstitutions extends readonly any[],
    Err extends string = ''
> =
    Path extends ''
        ? [
            T,
            Original[0] extends (ResolvedPath extends '' ? string : `${TrimDots<ResolvedPath>}.${string}`)
                ? TrimDots<`${TrimDots<ResolvedPath>}.${Extract<keyof UnionToIntersection<T>, KeyLike>}`>
            : never,
            ResolvedSubstitutions,
            Err extends ''
                ? ResolvedSubstitutions extends Original[1]
                    ? '' // success
                : `received substitutions are unmet with resolved substitutions`
            : Err,
        ]
    : Path extends '.'
        ? _ResolveObjectPath<
            Original,
            T,
            '',
            Substitutions,
            ResolvedPath,
            ResolvedSubstitutions,
            `cannot resolve an object path at '${ResolvedPath}.': cannot use dot as the last character`
        >
    : (Path extends `${string}.${string}` ? Path : `${Path}.`) extends `${infer Fragment}.${infer RestFragments}`
        ? Fragment extends KeyLike
            ? Fragment extends ''
                ? _ResolveObjectPath<
                    Original,
                    T,
                    '',
                    Substitutions,
                    ResolvedPath,
                    ResolvedSubstitutions,
                    `cannot resolve an object path at '${ResolvedPath}..': duplicated dot`
                >
            : (
                Extract<T, RR<Fragment, any>> extends RR<Fragment, infer Value>
                    ? unknown extends Value
                        ? Through
                    : Break<_ResolveObjectPath<
                        Original,
                        Value,
                        RestFragments,
                        Substitutions,
                        `${ResolvedPath}.${Fragment}`,
                        ResolvedSubstitutions
                    >>
                : Through
            ) extends Break<infer R>
                ? R
            : (
                Fragment extends `${number}`
                    ? Extract<T, readonly any[]> extends RR<number, infer Value> // T is an array
                        ? unknown extends Value
                            ? Through
                        : Value[] extends T // but not a tuple
                            ? Break<_ResolveObjectPath<
                                Original,
                                Value,
                                RestFragments,
                                Substitutions,
                                `${ResolvedPath}.${Fragment}`,
                                ResolvedSubstitutions
                            >>
                        : Break<_ResolveObjectPath< // T is a tuple, but the fragment should be met in the phase before here
                            Original,
                            T,
                            '',
                            Substitutions,
                            ResolvedPath,
                            ResolvedSubstitutions,
                            `cannot resolve an object path at '${ResolvedPath}.${Fragment}': '${Fragment}' is out of range of the tuple '${ResolvedPath}'`
                        >>
                    : Break<_ResolveObjectPath< // T is neither of an array or a tuple, hence T doesn't accept index-like key
                        Original,
                        T,
                        '',
                        Substitutions,
                        ResolvedPath,
                        ResolvedSubstitutions,
                        `cannot resolve an object path at '${ResolvedPath}.${Fragment}': unexpected index-like fragment '${Fragment}'`
                    >>
                : Through
            ) extends Break<infer R>
                ? R
            : Fragment extends `{}` // it is substitution
                ? [...Substitutions, {}] extends [infer Substitution, ...infer RestSubstitutions]
                    ? (
                        Substitution extends KeyLike
                            ? (
                                Extract<T, RR<`${Substitution}`, any>> extends RR<`${Substitution}`, infer Value>
                                    ? unknown extends Value
                                        ? Through
                                    : Break<_ResolveObjectPath<
                                        Original,
                                        Value,
                                        RestFragments,
                                        RestSubstitutions,
                                        `${ResolvedPath}.${Fragment}`,
                                        readonly [...ResolvedSubstitutions, Substitution]
                                    >>
                                : Through
                            ) extends Break<infer R>
                                ? Break<R>
                            : (
                                `${Substitution}` extends `${number}`
                                    ? Extract<T, readonly any[]> extends RR<number, infer Value> // T is an array
                                        ? unknown extends Value
                                            ? Through
                                        : Break<_ResolveObjectPath< // skip checking if T is a tuple: whether the index-like substitution is met with the range of the tuple should be ensured on runtime
                                            Original,
                                            Value,
                                            RestFragments,
                                            RestSubstitutions,
                                            `${ResolvedPath}.${Fragment}`,
                                            readonly [...ResolvedSubstitutions, Substitution]
                                        >>
                                    : Through
                                : Through
                            ) extends Break<infer R>
                                ? Break<R>
                            : Through
                        : Through
                    ) extends Break<infer R>
                        ? R
                    : _ResolveObjectPath<
                        Original,
                        T[keyof T],
                        RestFragments,
                        RestSubstitutions,
                        `${ResolvedPath}.${Fragment}`,
                        readonly [...ResolvedSubstitutions, keyof T]
                    >
                : Unreachable
            : _ResolveObjectPath<
                Original,
                T,
                '',
                Substitutions,
                ResolvedPath,
                ResolvedSubstitutions,
                `cannot resolve an object path at '${ResolvedPath}.${Fragment}': path unmet with the keys of received type T`
            >
        : Unreachable
    : Unreachable
;
