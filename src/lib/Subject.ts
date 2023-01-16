class Subject<T> {
  observers: Array<(value: T) => void> = [];

  next(value: T) {
    this.observers.forEach((observer) => observer(value));
  }

  subscribe(observer: (value: T) => void): () => void {
    this.observers.push(observer);

    return () => {
      const index = this.observers.indexOf(observer);
      this.observers.splice(index, 1);
    };
  }
}

export default Subject;
