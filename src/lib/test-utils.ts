import {
  ModelEnvScopes,
  FieldTypes,
  ValidatorsDefinition,
  Data,
  DataModel,
  FieldsDefinition,
} from "@graphand/core";

export const generateRandomString = () => {
  return "a" + Math.random().toString(36).substring(7);
};

export const mockModel = ({
  scope = ModelEnvScopes.ENV,
  fields = {
    title: {
      type: FieldTypes.TEXT,
      options: {},
    },
  },
  validators = [],
}: {
  scope?: ModelEnvScopes;
  fields?: FieldsDefinition;
  validators?: ValidatorsDefinition;
} = {}) => {
  const uidSlug = generateRandomString();

  class Test extends Data {
    static slug = uidSlug;
    static scope = scope;
    static fields = fields;
    static validators = validators;

    constructor(doc) {
      super(doc);

      this.defineFieldsProperties();
    }

    title;
  }

  Test.__datamodel = new DataModel({
    slug: uidSlug,
    fields,
    validators,
  });

  return Test;
};
