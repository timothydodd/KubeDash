import { AbstractControl, FormGroup, UntypedFormArray, UntypedFormControl, UntypedFormGroup } from '@angular/forms';

import { Constants } from './constants';

export interface PathInfo {
  key: string;
  ignore: boolean;
}

export class FormGroupHelper {
  public static syncFormSource(formItem: UntypedFormGroup | UntypedFormArray, source: any) {
    for (const formControlName in formItem.controls) {
      if (Object.prototype.hasOwnProperty.call(formItem, formControlName)) {
        const formControl = (formItem.controls as { [key: string]: AbstractControl<any, any> })[formControlName];

        if (formControl instanceof UntypedFormControl) {
          source[formControlName] = formControl.value;
        } else if (formControl instanceof UntypedFormArray && formControl.dirty && formControl.controls.length > 0) {
          this.syncFormSource(formControl, source[formControlName]);
        } else if (formControl instanceof UntypedFormGroup && formControl.dirty) {
          this.syncFormSource(formControl, source[formControlName]);
        }
      }
    }
  }

  public static getUpdates<T extends { [K in keyof T]: AbstractControl<any, any> }>(
    formItem: UntypedFormGroup | UntypedFormArray | UntypedFormControl | FormGroup<T>,
    updatedValues: PatchItem[],
    path: string,
    pathKeys: Dictionary<PathInfo> | null = null,
    fullObject: Set<string> | null = null
  ) {
    if (formItem instanceof UntypedFormControl) {
      if (path && formItem.dirty) {
        updatedValues.push({
          op: 'replace',
          path,
          value: formItem.value,
        });
      }
    } else {
      for (const formControlName in formItem.controls) {
        if (Object.prototype.hasOwnProperty.call(formItem.controls, formControlName)) {
          const formControl = (formItem.controls as { [key: string]: AbstractControl<any, any> })[formControlName];
          if (formControl instanceof UntypedFormControl) {
            this.getUpdates(formControl, updatedValues, path + '/' + formControlName, pathKeys);
          } else if (formControl instanceof UntypedFormArray && formControl.dirty && formControl.controls.length > 0) {
            const nPath = path + '/' + formControlName;
            if (pathKeys) {
              if (hasKey(pathKeys, nPath)) {
                const ignore = pathKeys[nPath].ignore;
                if (ignore && ignore === true) {
                  continue;
                }
              }
            }
            this.getUpdates(formControl, updatedValues, nPath, pathKeys);
          } else if (formControl instanceof UntypedFormGroup && formControl.dirty) {
            let key = formControlName;

            if (fullObject && fullObject.has(`${path}/${formControlName}`)) {
              updatedValues.push({
                op: 'replace',
                path: `${path}/${formControlName}`,
                value: formControl.value,
              });
              return;
            }
            if (pathKeys) {
              if (hasKey(pathKeys, path)) {
                const idPath = pathKeys[path].key;

                const fg = formControl;
                if (fg) {
                  const id = fg.get(idPath)?.value;
                  key = id;
                  const removed = fg.get('removed');
                  if (removed && removed.value === true) {
                    if (id !== Constants.EMPTY_GUID) {
                      updatedValues.push({
                        op: 'remove',
                        path: `${path}/${key}`,
                        value: null,
                      });
                    }
                    continue;
                  }
                  if (id === Constants.EMPTY_GUID) {
                    updatedValues.push({
                      op: 'add',
                      path,
                      value: fg.value,
                    });
                    continue;
                  }
                }
              }
            }
            this.getUpdates(formControl, updatedValues, path + '/' + key, pathKeys);
          }
        }
      }
    }
  }

  public static getErrors(
    formItem: UntypedFormGroup | UntypedFormArray | UntypedFormControl,
    errors: FormControlWrap[],
    name: string
  ) {
    if (formItem instanceof UntypedFormControl) {
      if (formItem.invalid) {
        const text = name;
        const result = text.replace(/([A-Z])/g, ' $1');
        const finalResult = result.charAt(0).toUpperCase() + result.slice(1);

        errors.push({
          name: finalResult,
          control: formItem,
        } as FormControlWrap);
      }
    } else {
      if (formItem.controls instanceof Array) {
        for (let i = 0; i < formItem.controls.length; i++) {
          const formControl = formItem.controls[i];
          if (formControl instanceof UntypedFormControl) {
            this.getErrors(formControl, errors, `${name}[${i}]`);
          } else if (formControl instanceof UntypedFormArray && formControl.dirty && formControl.controls.length > 0) {
            this.getErrors(formControl, errors, `${name}[${i}]`);
          } else if (formControl instanceof UntypedFormGroup && formControl.dirty) {
            this.getErrors(formControl, errors, `${name}[${i}]`);
          }
        }
      } else {
        for (const formControlName in formItem.controls) {
          if (Object.prototype.hasOwnProperty.call(formItem.controls, formControlName)) {
            const formControl = formItem.controls[formControlName];
            if (formControl instanceof UntypedFormControl) {
              this.getErrors(formControl, errors, formControlName);
            } else if (
              formControl instanceof UntypedFormArray &&
              formControl.dirty &&
              formControl.controls.length > 0
            ) {
              this.getErrors(formControl, errors, formControlName);
            } else if (formControl instanceof UntypedFormGroup && formControl.dirty) {
              this.getErrors(formControl, errors, formControlName);
            }
          }
        }
      }
    }
  }
  public static addUpdates(items: Array<any>, path: string, patchItems: PatchItem[]) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      patchItems.push({
        op: 'add',
        path: `${path}/${i}`,
        value: item,
      });
    }
  }
  public static removeUpdates(items: Array<any>, path: string, patchItems: PatchItem[]) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      patchItems.push({
        op: 'remove',
        path: `${path}/${i}`,
        value: item,
      });
    }
  }
}

export interface PatchItem {
  op: string;
  path: string;
  value: string | null;
}
export interface JsonPatchDocument {
  Operations: PatchItem[];
}
export interface FormControlWrap {
  name: string;
  control: UntypedFormControl;
}
export interface Dictionary<T> {
  [key: string]: T;
}
export function hasKey<T>(dictionary: Dictionary<T>, key: string): boolean {
  return key in dictionary;
}
