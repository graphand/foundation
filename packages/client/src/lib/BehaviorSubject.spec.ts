import { vi } from "vitest";
import { BehaviorSubject } from "./BehaviorSubject.js";
import { SubjectObserver } from "../types.js";

describe("BehaviorSubject", () => {
  let behaviorSubject: BehaviorSubject<number>;
  const initialValue = 0;

  beforeEach(() => {
    behaviorSubject = new BehaviorSubject<number>(initialValue);
  });

  it("should initialize with the initial value", () => {
    expect(behaviorSubject.getValue()).toBe(initialValue);
  });

  it("should get the current value", () => {
    expect(behaviorSubject.getValue()).toBe(0);
    behaviorSubject.next(10);
    expect(behaviorSubject.getValue()).toBe(10);
  });

  it("should notify new observer with current value immediately", () => {
    const observer: SubjectObserver<number> = vi.fn();
    behaviorSubject.subscribe(observer);
    expect(observer).toHaveBeenCalledWith(initialValue, undefined);
  });

  it("should notify observers with new and previous values", () => {
    const observer: SubjectObserver<number> = vi.fn();
    behaviorSubject.subscribe(observer);
    behaviorSubject.next(10);
    expect(observer).toHaveBeenCalledWith(10, 0);
  });

  it("should update current value on next", () => {
    behaviorSubject.next(10);
    expect(behaviorSubject.getValue()).toBe(10);
  });

  it("should notify all observers on next", () => {
    const observer1: SubjectObserver<number> = vi.fn();
    const observer2: SubjectObserver<number> = vi.fn();
    behaviorSubject.subscribe(observer1);
    behaviorSubject.subscribe(observer2);
    behaviorSubject.next(10);
    expect(observer1).toHaveBeenCalledWith(10, 0);
    expect(observer2).toHaveBeenCalledWith(10, 0);
  });

  it("should allow observer to unsubscribe", () => {
    const observer: SubjectObserver<number> = vi.fn();
    const unsubscribe = behaviorSubject.subscribe(observer);
    unsubscribe();
    behaviorSubject.next(10);
    expect(observer).toHaveBeenCalledTimes(1); // Called initially with current value
  });

  it("should notify new observer with the latest value", () => {
    behaviorSubject.next(10);
    const observer: SubjectObserver<number> = vi.fn();
    behaviorSubject.subscribe(observer);
    expect(observer).toHaveBeenCalledWith(10, undefined);
  });

  it("should not notify unsubscribed observer", () => {
    const observer: SubjectObserver<number> = vi.fn();
    const unsubscribe = behaviorSubject.subscribe(observer);
    unsubscribe();
    behaviorSubject.next(10);
    expect(observer).not.toHaveBeenCalledWith(10, 0);
  });

  it("should notify all observers even after one unsubscribes", () => {
    const observer1: SubjectObserver<number> = vi.fn();
    const observer2: SubjectObserver<number> = vi.fn();
    const unsubscribe1 = behaviorSubject.subscribe(observer1);
    behaviorSubject.subscribe(observer2);
    unsubscribe1();
    behaviorSubject.next(10);
    expect(observer1).not.toHaveBeenCalledWith(10, 0);
    expect(observer2).toHaveBeenCalledWith(10, 0);
  });

  it("should notify observer with the correct previous value", () => {
    const observer: SubjectObserver<number> = vi.fn();
    behaviorSubject.subscribe(observer);
    behaviorSubject.next(10);
    behaviorSubject.next(20);
    expect(observer).toHaveBeenCalledWith(20, 10);
  });

  it("should not affect other observers when one unsubscribes", () => {
    const observer1: SubjectObserver<number> = vi.fn();
    const observer2: SubjectObserver<number> = vi.fn();
    const unsubscribe1 = behaviorSubject.subscribe(observer1);
    behaviorSubject.subscribe(observer2);
    unsubscribe1();
    behaviorSubject.next(10);
    expect(observer1).not.toHaveBeenCalledWith(10, 0);
    expect(observer2).toHaveBeenCalledWith(10, 0);
  });

  it("should notify observers with updated value immediately after subscription", () => {
    behaviorSubject.next(10);
    const observer: SubjectObserver<number> = vi.fn();
    behaviorSubject.subscribe(observer);
    expect(observer).toHaveBeenCalledWith(10, undefined);
  });

  it("should allow re-subscribing an observer", () => {
    const observer: SubjectObserver<number> = vi.fn();
    const unsubscribe = behaviorSubject.subscribe(observer);
    unsubscribe();
    behaviorSubject.subscribe(observer);
    behaviorSubject.next(10);
    expect(observer).toHaveBeenCalledWith(10, 0);
  });

  it("should maintain state independently for different instances", () => {
    const behaviorSubject2 = new BehaviorSubject<number>(initialValue);
    const observer1: SubjectObserver<number> = vi.fn();
    const observer2: SubjectObserver<number> = vi.fn();
    behaviorSubject.subscribe(observer1);
    behaviorSubject2.subscribe(observer2);
    behaviorSubject.next(10);
    behaviorSubject2.next(20);
    expect(observer1).toHaveBeenCalledWith(10, 0);
    expect(observer2).toHaveBeenCalledWith(20, 0);
  });
});
