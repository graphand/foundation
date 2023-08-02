import { SubjectObserver } from "../types";

class Subject<T> {
  #observers: Array<SubjectObserver<T>> = [];
  #previousValue: T;

  setPreviousValue(value: T) {
    this.#previousValue = value;
  }

  next(value: T) {
    this.#observers.forEach((observer) => observer(value, this.#previousValue));
    this.#previousValue = value;
  }

  subscribe(observer: SubjectObserver<T>): () => void {
    this.#observers.push(observer);

    return () => {
      const index = this.#observers.indexOf(observer);
      this.#observers.splice(index, 1);
    };
  }
}

export default Subject;
