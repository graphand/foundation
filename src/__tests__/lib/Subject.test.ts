import Subject from "../../lib/Subject";

describe("Subject", () => {
  test("next should call subscribed observers with the value", () => {
    const subject = new Subject<number>();
    const observer1 = jest.fn();
    const observer2 = jest.fn();

    subject.subscribe(observer1);
    subject.subscribe(observer2);

    const value = 42;
    subject.next(value);

    expect(observer1).toHaveBeenCalledWith(value, undefined);
    expect(observer2).toHaveBeenCalledWith(value, undefined);
  });

  test("unsubscribe should remove observer from the observers list", () => {
    const subject = new Subject<number>();
    const observer = jest.fn();

    const unsubscribe = subject.subscribe(observer);
    unsubscribe();

    subject.next(42);

    expect(observer).not.toHaveBeenCalled();
  });

  test("multiple unsubscriptions should not throw errors", () => {
    const subject = new Subject<number>();
    const observer = jest.fn();

    const unsubscribe = subject.subscribe(observer);
    unsubscribe();
    unsubscribe(); // Call it again to make sure it doesn't throw an error

    subject.next(42);

    expect(observer).not.toHaveBeenCalled();
  });

  test("next should call subscribed observers with the value and previous value", () => {
    const subject = new Subject<number>();
    const observer1 = jest.fn();
    const observer2 = jest.fn();

    subject.subscribe(observer1);
    subject.subscribe(observer2);

    const value1 = 42;
    const value2 = 24;
    subject.next(value1);
    subject.next(value2);

    expect(observer1).toHaveBeenNthCalledWith(1, value1, undefined); // First call, no previous value.
    expect(observer1).toHaveBeenNthCalledWith(2, value2, value1); // Second call, previous value is value1.

    expect(observer2).toHaveBeenNthCalledWith(1, value1, undefined); // Same expectations for observer2.
    expect(observer2).toHaveBeenNthCalledWith(2, value2, value1);
  });
});
