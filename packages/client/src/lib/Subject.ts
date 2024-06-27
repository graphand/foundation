import { SubjectObserver } from "../types";

class Subject<T> {
  #observers: Array<SubjectObserver<T>> = [];
  #previousValue: T;

  constructor(initialValue: T) {
    this.#previousValue = initialValue;
  }

  setPreviousValue(value: T) {
    this.#previousValue = value;
  }

  next(value: T) {
    [...this.#observers].forEach((o) => o(value, this.#previousValue));
    this.#previousValue = value;
  }

  subscribe(observer: SubjectObserver<T>): () => void {
    if (!this.#observers.includes(observer)) {
      this.#observers.push(observer);
    }

    return () => {
      const index = this.#observers.indexOf(observer);
      if (index > -1) {
        this.#observers.splice(index, 1);
      }
    };
  }
}

export default Subject;
