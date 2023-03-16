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
}

export default BehaviorSubject;
