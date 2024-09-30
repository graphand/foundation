import { SubjectObserver } from "@/types.ts";
import { Subject } from "./Subject.ts";

export class BehaviorSubject<T> extends Subject<T> {
  #currentValue: T;

  constructor(initialValue: T) {
    super(initialValue);
    this.#currentValue = initialValue;
  }

  getValue() {
    return this.#currentValue;
  }

  next(value: T) {
    this.#currentValue = value;
    super.next(value);
  }

  subscribe(observer: SubjectObserver<T>): () => void {
    observer(this.#currentValue, undefined);
    return super.subscribe(observer);
  }
}
