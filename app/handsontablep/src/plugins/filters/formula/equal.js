import {stringify} from 'handsontable/helpers/mixed';
import {registerFormula} from './../formulaRegisterer';

export const FORMULA_NAME = 'eq';

function formula(dataRow, [value] = inputValues) {
  return stringify(dataRow.value).toLowerCase() === stringify(value);
}

registerFormula(FORMULA_NAME, formula, {
  name: 'Sama dengan',
  inputsCount: 1
});
