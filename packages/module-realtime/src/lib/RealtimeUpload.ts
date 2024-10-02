import ModuleRealtime from "@/ModuleRealtime.js";
import { BehaviorSubject, SubjectObserver } from "@graphand/client";
import { UploadEvent } from "@graphand/core";

type UploadStatus = "pending" | "uploading" | "success" | "error" | "aborted";

type UploadState = {
  status: UploadStatus;
  percentage: number;
  receivedLength?: number;
  contentLength?: number;
};

class RealtimeUpload extends EventTarget {
  #module: ModuleRealtime;
  #id: string;
  #unsubscribe: () => void;
  #stateSubject = new BehaviorSubject<UploadState>({
    status: "pending",
    percentage: 0,
  });

  constructor(module: ModuleRealtime, id: string) {
    super();

    this.#module = module;
    this.#id = id;

    this.#unsubscribe = this.#module.socketSubject.subscribe(socket => {
      if (!socket) return;

      if (socket.connected) {
        socket.emit("subscribeUploads", this.#id);
      }

      socket.on("connect", () => {
        socket.emit("subscribeUploads", this.#id);
      });

      socket.on("upload:event", (event: UploadEvent) => {
        if (event.uploadId !== this.#id) {
          return;
        }

        const customEvent = new CustomEvent("event", {
          detail: event,
        });

        this.dispatchEvent(customEvent);

        let { type, percentage, contentLength, receivedLength } = event;

        contentLength ??= 0;
        receivedLength ??= 0;
        percentage ??= 0;

        const nextState: UploadState = { ...this.#stateSubject.getValue() };

        if (!this.hasEnded && nextState.status === "pending") {
          nextState.status = "uploading";
        }

        if (!this.hasEnded) {
          if (type === "end") {
            nextState.status = "success";
          }

          if (type === "error") {
            nextState.status = "error";
          }

          if (type === "abort") {
            nextState.status = "aborted";
          }
        }

        if (!nextState.contentLength || contentLength > nextState.contentLength) {
          nextState.contentLength = contentLength;
        }

        if (!nextState.receivedLength || receivedLength > nextState.receivedLength) {
          nextState.receivedLength = receivedLength;
        }

        if (!nextState.percentage || percentage > nextState.percentage) {
          nextState.percentage = percentage;
        }

        this.#stateSubject.next(nextState);
      });
    });
  }

  close() {
    this.#unsubscribe();
  }

  get state() {
    return this.#stateSubject.getValue();
  }

  subscribe(observer: SubjectObserver<UploadState>) {
    return this.#stateSubject.subscribe(observer);
  }

  get hasEnded() {
    const { status } = this.state;
    return ["success", "error", "aborted"].includes(status);
  }

  get id() {
    return this.#id;
  }
}

export default RealtimeUpload;
