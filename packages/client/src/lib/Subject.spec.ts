import { Subject } from "./Subject";
import { SubjectObserver } from "../types";

describe("Subject", () => {
  let subject: Subject<number>;
  const initialValue = 0;

  beforeEach(() => {
    subject = new Subject<number>(initialValue);
  });

  it("should initialize with the initial value", () => {
    expect(subject).toBeDefined();
  });

  it("should set previous value correctly", () => {
    subject.setPreviousValue(5);
    const observer: SubjectObserver<number> = jest.fn();
    subject.subscribe(observer);
    subject.next(10);
    expect(observer).toHaveBeenCalledWith(10, 5);
  });

  it("should notify observers with new and previous values", () => {
    const observer: SubjectObserver<number> = jest.fn();
    subject.subscribe(observer);
    subject.next(10);
    expect(observer).toHaveBeenCalledWith(10, 0);
  });

  it("should update previous value after next is called", () => {
    subject.next(10);
    const observer: SubjectObserver<number> = jest.fn();
    subject.subscribe(observer);
    subject.next(20);
    expect(observer).toHaveBeenCalledWith(20, 10);
  });

  it("should allow multiple observers to subscribe", () => {
    const observer1: SubjectObserver<number> = jest.fn();
    const observer2: SubjectObserver<number> = jest.fn();
    subject.subscribe(observer1);
    subject.subscribe(observer2);
    subject.next(10);
    expect(observer1).toHaveBeenCalledWith(10, 0);
    expect(observer2).toHaveBeenCalledWith(10, 0);
  });

  it("should remove an observer when unsubscribed", () => {
    const observer: SubjectObserver<number> = jest.fn();
    const unsubscribe = subject.subscribe(observer);
    unsubscribe();
    subject.next(10);
    expect(observer).not.toHaveBeenCalled();
  });

  it("should handle multiple unsubscriptions correctly", () => {
    const observer1: SubjectObserver<number> = jest.fn();
    const observer2: SubjectObserver<number> = jest.fn();
    const unsubscribe1 = subject.subscribe(observer1);
    const unsubscribe2 = subject.subscribe(observer2);
    unsubscribe1();
    unsubscribe2();
    subject.next(10);
    expect(observer1).not.toHaveBeenCalled();
    expect(observer2).not.toHaveBeenCalled();
  });

  it("should notify observers only once per next call", () => {
    const observer: SubjectObserver<number> = jest.fn();
    subject.subscribe(observer);
    subject.next(10);
    expect(observer).toHaveBeenCalledTimes(1);
  });

  it("should not notify unsubscribed observers", () => {
    const observer1: SubjectObserver<number> = jest.fn();
    const observer2: SubjectObserver<number> = jest.fn();
    const unsubscribe = subject.subscribe(observer1);
    subject.subscribe(observer2);
    unsubscribe();
    subject.next(10);
    expect(observer1).not.toHaveBeenCalled();
    expect(observer2).toHaveBeenCalledWith(10, 0);
  });

  it("should allow re-subscribing an observer", () => {
    const observer: SubjectObserver<number> = jest.fn();
    const unsubscribe = subject.subscribe(observer);
    unsubscribe();
    subject.subscribe(observer);
    subject.next(10);
    expect(observer).toHaveBeenCalledWith(10, 0);
  });

  it("should call observer with correct previous value after multiple next calls", () => {
    const observer: SubjectObserver<number> = jest.fn();
    subject.subscribe(observer);
    subject.next(10);
    subject.next(20);
    expect(observer).toHaveBeenLastCalledWith(20, 10);
  });

  it("should not affect other observers when one unsubscribes", () => {
    const observer1: SubjectObserver<number> = jest.fn();
    const observer2: SubjectObserver<number> = jest.fn();
    const unsubscribe1 = subject.subscribe(observer1);
    subject.subscribe(observer2);
    unsubscribe1();
    subject.next(10);
    expect(observer1).not.toHaveBeenCalled();
    expect(observer2).toHaveBeenCalledWith(10, 0);
  });

  it("should handle setting previous value directly", () => {
    subject.setPreviousValue(5);
    const observer: SubjectObserver<number> = jest.fn();
    subject.subscribe(observer);
    subject.next(10);
    expect(observer).toHaveBeenCalledWith(10, 5);
  });

  it("should not allow duplicate observers", () => {
    const observer: SubjectObserver<number> = jest.fn();
    subject.subscribe(observer);
    subject.subscribe(observer);
    subject.next(10);
    expect(observer).toHaveBeenCalledTimes(1);
  });

  it("should maintain state independently for different instances", () => {
    const subject2 = new Subject<number>(initialValue);
    const observer1: SubjectObserver<number> = jest.fn();
    const observer2: SubjectObserver<number> = jest.fn();
    subject.subscribe(observer1);
    subject2.subscribe(observer2);
    subject.next(10);
    subject2.next(20);
    expect(observer1).toHaveBeenCalledWith(10, 0);
    expect(observer2).toHaveBeenCalledWith(20, 0);
  });
});
