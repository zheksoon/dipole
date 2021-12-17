import { Observable, Computed } from "../core/classes";

const hasOwnProperty = Object.prototype.hasOwnProperty;

export function makeObservable(obj) {
    const descriptors = [];
    for (const key in obj) {
        if (hasOwnProperty.call(obj, key)) {
            const currentDescriptor = Object.getOwnPropertyDescriptor(obj, key);
            if (currentDescriptor.configurable && currentDescriptor.value !== undefined) {
                const prop = currentDescriptor.value;

                if (prop instanceof Observable) {
                    descriptors.push({
                        key: key,
                        enumerable: true,
                        configurable: true,
                        get() {
                            return prop.get();
                        },
                        set(value) {
                            prop.set(value);
                        },
                    });
                } else if (prop instanceof Computed) {
                    descriptors.push({
                        key: key,
                        enumerable: true,
                        configurable: true,
                        get() {
                            return prop.get();
                        },
                    });
                }
            }
        }
    }

    descriptors.forEach((descriptor) => {
        Object.defineProperty(obj, descriptor.key, descriptor);
    });

    return obj;
}

// fool typescript a bit for seamless intergration with makeObservable
export function asProp(value) {
    return value;
}

const isSymbolAvailable = typeof Symbol !== "undefined";

const observablesProp = isSymbolAvailable ? Symbol("$$observables") : "$$observables";
const observableKeysProp = isSymbolAvailable ? Symbol("$$observableKeys") : "$$observableKeys";

export function makeObservableProto(obj, targetClass, observables) {
    const proto = targetClass.prototype;

    if (!hasOwnProperty.call(proto, observableKeysProp)) {
        let observableKeys = Object.keys(observables);
        if (Object.getOwnPropertySymbols) {
            const symbolKeys = Object.getOwnPropertySymbols(observables);
            if (symbolKeys.length > 0) {
                observableKeys = observableKeys.concat(symbolKeys);
            }
        }

        const descriptors = observableKeys.map((key) => {
            const value = observables[key];

            if (value instanceof Observable) {
                return {
                    key,
                    enumerable: true,
                    configurable: false,
                    get() {
                        return this[observablesProp][key].get();
                    },
                    set(value) {
                        this[observablesProp][key].set(value);
                    },
                };
            } else if (value instanceof Computed) {
                return {
                    key,
                    enumerable: true,
                    configurable: false,
                    get() {
                        return this[observablesProp][key].get();
                    },
                };
            } else {
                throw new Error("Only instances of Observable or Computed are allowed");
            }
        });

        if (isSymbolAvailable) {
            proto[observableKeysProp] = observableKeys;
        } else {
            Object.defineProperty(proto, observableKeysProp, {
                enumerable: false,
                writable: false,
                value: observableKeys,
            });
        }

        descriptors.forEach((descriptor) => {
            Object.defineProperty(proto, descriptor.key, descriptor);
        });
    }

    const existingObservables = obj[observablesProp];
    const updatedObservables = Object.assign(existingObservables || {}, observables);

    if (!existingObservables) {
        if (isSymbolAvailable) {
            obj[observablesProp] = updatedObservables;
        } else {
            Object.defineProperty(obj, observablesProp, {
                enumerable: false,
                writable: false,
                value: updatedObservables,
            });
        }
    }
}
