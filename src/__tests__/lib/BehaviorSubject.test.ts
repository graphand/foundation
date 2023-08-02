import BehaviorSubject from "../../lib/BehaviorSubject";

describe("BehaviorSubject", () => {
  test("getValue should return the current value", () => {
    const initialValue = 42;
    const behaviorSubject = new BehaviorSubject<number>(initialValue);

    expect(behaviorSubject.getValue()).toEqual(initialValue);
  });

  test("next should update the current value and call subscribed observers", () => {
    const initialValue = 42;
    const behaviorSubject = new BehaviorSubject<number>(initialValue);

    const observer = jest.fn();
    behaviorSubject.subscribe(observer);

    const newValue = 84;
    behaviorSubject.next(newValue);

    expect(behaviorSubject.getValue()).toEqual(newValue);
    expect(observer).toHaveBeenCalledWith(newValue, 42);
  });

  test("subscribe should call the observer with the current value immediately", () => {
    const initialValue = 42;
    const behaviorSubject = new BehaviorSubject<number>(initialValue);

    const observer = jest.fn();
    behaviorSubject.subscribe(observer);

    expect(observer).toHaveBeenCalledWith(initialValue, undefined);
  });

  test("unsubscribe should remove observer from the observers list", () => {
    const initialValue = 42;
    const behaviorSubject = new BehaviorSubject<number>(initialValue);

    const observer = jest.fn();
    const unsubscribe = behaviorSubject.subscribe(observer);
    unsubscribe();

    const newValue = 84;
    behaviorSubject.next(newValue);

    expect(observer).toHaveBeenCalledTimes(1);
    expect(observer).toHaveBeenCalledWith(initialValue, undefined);
  });

  test("next should call subscribed observers with the value and previous value", () => {
    const initialValue = 42;
    const behaviorSubject = new BehaviorSubject<number>(initialValue);
    const observer = jest.fn();

    behaviorSubject.subscribe(observer);

    const newValue1 = 24;
    behaviorSubject.next(newValue1);
    const newValue2 = 84;
    behaviorSubject.next(newValue2);

    expect(observer).toHaveBeenNthCalledWith(1, initialValue, undefined); // First call, no previous value.
    expect(observer).toHaveBeenNthCalledWith(2, newValue1, initialValue); // Second call, previous value is initialValue.
    expect(observer).toHaveBeenNthCalledWith(3, newValue2, newValue1); // Third call, previous value is newValue1.
  });
});
