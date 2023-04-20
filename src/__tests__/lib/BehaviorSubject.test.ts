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
    expect(observer).toHaveBeenCalledWith(newValue);
  });

  test("subscribe should call the observer with the current value immediately", () => {
    const initialValue = 42;
    const behaviorSubject = new BehaviorSubject<number>(initialValue);

    const observer = jest.fn();
    behaviorSubject.subscribe(observer);

    expect(observer).toHaveBeenCalledWith(initialValue);
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
    expect(observer).toHaveBeenCalledWith(initialValue);
  });
});
