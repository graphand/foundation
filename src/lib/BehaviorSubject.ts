import { SubjectObserver } from "../types";
import Subject from "./Subject";

class BehaviorSubject<T> extends Subject<T> {
  #currentValue: T;

  constructor(initialValue: T) {
    super();
    this.#currentValue = initialValue;
    this.setPreviousValue(initialValue);
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

export default BehaviorSubject;
