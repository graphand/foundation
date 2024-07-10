import {
  Field,
  JSONQuery,
  ValidationError,
  ValidationFieldError,
  ValidationValidatorError,
  Validator,
} from "@graphand/core";
import { ModuleConstructor, ModuleWithConfig } from "@/types";
import { ClientError } from "./ClientError";

export const canUseIds = (query: JSONQuery): boolean => {
  if (
    !query.ids ||
    !Array.isArray(query.ids) ||
    !query.ids?.length ||
    query.filter ||
    query.pageSize ||
    query.limit ||
    query.skip ||
    query.sort ||
    query.populate
  ) {
    return false;
  }

  return true;
};

export const decodeClientModule = <T extends ModuleConstructor>(
  module: ModuleWithConfig<T>,
): {
  moduleClass: T;
  conf: ModuleWithConfig<T>[1];
} => {
  let moduleClass: T | undefined;
  let conf: ModuleWithConfig<T>[1];

  if (Array.isArray(module)) {
    moduleClass = module[0];
    conf = module[1];
  }

  if (!moduleClass) {
    throw new Error("Module class not found");
  }

  return { moduleClass, conf: conf || {} };
};

export const parseErrorFromJSON = (json: any) => {
  if (json?.type === "ValidationError") {
    const fields = json.reason?.fields?.map((f: any) => {
      const field = new Field(
        {
          type: f.field.type,
          options: f.field.options,
        },
        f.field.path,
      );
      return new ValidationFieldError({
        slug: f.slug,
        field,
      });
    });
    const validators = json.reason?.validators?.map((v: any) => {
      const validator = new Validator(
        {
          type: v.validator.type,
          options: v.validator.options,
        },
        v.validator.path,
      );

      return new ValidationValidatorError({
        validator,
        value: v.value,
      });
    });
    throw new ValidationError({
      fields,
      validators,
    });
  }

  throw new ClientError(json);
};
