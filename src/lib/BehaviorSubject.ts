import Subject from "./Subject";

class BehaviorSubject<T> extends Subject<T> {
  private currentValue: T;
  observers: Array<(value: T) => void> = [];

  constructor(initialValue: T) {
    super();
    this.currentValue = initialValue;
  }

  getValue() {
    return this.currentValue;
  }

  next(value: T) {
    this.currentValue = value;
    this.observers.forEach((observer) => observer(value));
  }

  subscribe(observer: (value: T) => void): () => void {
    this.observers.push(observer);
    observer(this.currentValue);

    return () => {
      const index = this.observers.indexOf(observer);
      this.observers.splice(index, 1);
    };
  }
}

export default BehaviorSubject;
