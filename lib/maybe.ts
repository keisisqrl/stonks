export abstract class Maybe<T> {

  static from<T>(contents: T): Just<T>
  static from<T>(contents?: null | undefined): Nothing<T>
  static from<T>(contents?: null | T | undefined): Maybe<T> {
    return (contents == null) ? new Nothing() : new Just(contents);
  }

  abstract getOrElse<U extends T>(def: U): T | U;
  abstract isEmpty(): this is Nothing<T>;
  abstract toString(): string;
  abstract toJSON(): T | null;
  abstract orElse<U extends T>(alt: Maybe<U>): Maybe<T> | Maybe<U>;
  abstract map<U>(f: (value: T) => U): Maybe<U>
}

export class Just<T> extends Maybe<T> {
  constructor(private contents: T) {
    super();
  }

  getOrElse<U extends T>(_: U): T {
    return this.contents;
  }

  isEmpty() { return false;}

  toString() {
    return `Just(${this.contents})`
  }

  toJSON(): T {
    return this.contents;
  }

  orElse<U extends T>(_alt: Maybe<U>): Just<T> {
    return this;
  }

  map<U>(f: (value: T) => U): Just<U> {
    return new Just<U>(
      f(this.contents)
    );
  }
}

export class Nothing<T> extends Maybe<T> {
  getOrElse<U extends T>(def: U): U {
    return def
  }

  isEmpty() { return true; }

  toString() {
    return "Nothing";
  }

  toJSON(): null {
    return null;
  }

  orElse<U extends T>(alt: Just<U>): Just<U>
  orElse<U extends T>(alt: Nothing<U>): Nothing<T>
  orElse<U extends T>(alt: Just<U> | Nothing<U>): Nothing<T> | Just<U> {
    if(alt.isEmpty()) {
      return this;
    } else {
      return alt;
    }
  }

  map<U>(_f: (value: T) => U): Nothing<U> {
    return new Nothing<U>();
  }
}
