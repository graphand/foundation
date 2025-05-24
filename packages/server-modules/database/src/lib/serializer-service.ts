import { ModuleDatabase } from "@/module.js";
import xxhash, { XXHashAPI } from "xxhash-wasm";
import { Model, ModelData } from "@graphand/core";
import { BSON } from "mongodb";

export class SerializerService {
  #module: ModuleDatabase;
  #xxhash: XXHashAPI | null = null;

  constructor(module: ModuleDatabase) {
    this.#module = module;
  }

  async init() {
    this.#xxhash = await xxhash();
  }

  toBuffer(document?: ModelData | null): Buffer {
    const data = document ? { $d: document } : { $null: true };
    return BSON.serialize(data) as Buffer;
  }

  toBufferList(documents?: ModelData[] | null): Buffer {
    const data = documents ? { $d: documents } : { $null: true };
    return BSON.serialize(data) as Buffer;
  }

  fromBuffer<M extends typeof Model>(buffer: Buffer): ModelData<M> | null {
    if (!buffer) {
      return null;
    }

    const res = BSON.deserialize(buffer);
    if (res.$null || !res.$d) {
      return null;
    }

    return res.$d as ModelData<M>;
  }

  fromBufferList<M extends typeof Model>(buffer: Buffer): ModelData<M>[] | null {
    const res = BSON.deserialize(buffer);
    if (res.$null || !res.$d) {
      return null;
    }

    if (res.$d) {
      return Object.values(res.$d) as ModelData<M>[];
    }

    throw new Error("Invalid buffer");
  }
}
