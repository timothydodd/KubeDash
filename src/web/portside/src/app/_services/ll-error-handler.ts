import { UntypedFormGroup } from '@angular/forms';

export class LLErrorHandler {
  public static processError(error: any, formGroup: UntypedFormGroup | null = null): string {
    const valError = error as ValidationError;

    if (valError) {
      if (formGroup) {
        if (Array.isArray(valError.errors)) {
          if (valError.errors?.length > 0) {
            for (const e of error.errors) {
              if (e.field) {
                const pf = formGroup.get(e.field);
                if (pf) {
                  pf.setErrors({ incorrect: true });
                }
              }
            }
          }
        } else if (this.isObject(valError.errors)) {
          for (const errField in valError.errors as any) {
            const pf = formGroup.get(errField.toLowerCase());
            const fieldErrors = (valError.errors as { [key: string]: any })[errField];
            if (pf) {
              pf.setErrors({
                ...fieldErrors,
              });
            }
          }
        }

        if (error?.message) {
          return error.message;
        }

        // http request failure
        if (error.status && error.title && this.isObject(error.errors)) {
          let message = `<strong>(Http Status: ${error.status}) - ${error.title}</strong>`;
          for (const fieldErrors in valError.errors as any) {
            if (Array.isArray(fieldErrors)) {
              for (const errorMsg of fieldErrors) {
                message += ` ${errorMsg}`;
              }
            }
          }
          return message;
        }
      }
      if (error instanceof ProgressEvent) {
        return `Server connection error.`;
      }
      if (error?.message) {
        return error.message;
      }
      if (error?.title) {
        return error.title;
      }
      return 'Unknown Error';
    } else {
      const errorMessage = 'Unexpected Error';
      console.log(error);
      return errorMessage;
    }
  }
  static isObject(value: any) {
    return value === null || (value && value.toString() === '[object Object]');
  }
}
export interface ValidationError {
  message: string;
  errors: FieldError[];
}
export interface FieldError {
  message: string;
  field: string;
}
