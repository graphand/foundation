import Subject from "./Subject";

class BehaviorSubject<T> extends Subject<T> {
  private currentValue: T;

  constructor(initialValue: T) {
    super();
    this.currentValue = initialValue;
  }

  getValue() {
    return this.currentValue;
  }

  next(value: T) {
    this.currentValue = value;
    super.next(value);
  }

  subscribe(observer: (value: T) => void): () => void {
    observer(this.currentValue);
    return super.subscribe(observer);
  }
}

export default BehaviorSubject;
