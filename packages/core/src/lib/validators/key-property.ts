import { ValidatorTypes } from "@/enums/validator-types.js";
import { Validator } from "@/lib/validator.js";
import { Patterns } from "@/enums/patterns.js";
import { getValidatorClass } from "../utils.js";

export class ValidatorKeyProperty extends Validator<ValidatorTypes.KEY_PROPERTY> {
  validate: Validator<ValidatorTypes.KEY_PROPERTY>["validate"] = async opts => {
    const { model } = opts;
    const adapter = model?.getAdapter();
    const validatorsMap = adapter?.base.validatorsMap ?? {};

    const _getValidator = <T extends ValidatorTypes>(type: T): typeof Validator<T> => {
      let v: typeof Validator<T> | undefined = validatorsMap[type];
      if (v === undefined) {
        v = getValidatorClass(type, adapter);
      }

      return v || Validator;
    };

    const ValidatorRegex = _getValidator(ValidatorTypes.REGEX);
    const validatorRegex = new ValidatorRegex(
      {
        type: ValidatorTypes.REGEX,
        property: this.definition.property,
        pattern: Patterns.SLUG,
      },
      this.path,
    );

    const ValidatorRequired = _getValidator(ValidatorTypes.REQUIRED);
    const validatorRequired = new ValidatorRequired(
      {
        type: ValidatorTypes.REQUIRED,
        property: this.definition.property,
      },
      this.path,
    );

    const ValidatorUnique = _getValidator(ValidatorTypes.UNIQUE);
    const validatorUnique = new ValidatorUnique(
      {
        type: ValidatorTypes.UNIQUE,
        property: this.definition.property,
      },
      this.path,
    );

    const validates = await Promise.all([
      validatorRegex?.validate?.(opts),
      validatorRequired?.validate?.(opts),
      validatorUnique?.validate?.(opts),
    ]);

    return validates.every(Boolean);
  };
}
