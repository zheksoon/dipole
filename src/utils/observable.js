import { Observable, Computed } from '../dipole'

export function makeObservable(obj) {
    const descriptors = [];
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const currentDescriptor = Object.getOwnPropertyDescriptor(obj, key)
            if (currentDescriptor.configurable && currentDescriptor.value !== undefined) {
                const prop = currentDescriptor.value

                if (prop instanceof Observable) {
                    descriptors.push({
                        key: key,
                        enumerable: true,
                        configurable: true,
                        get() {
                            return prop.get()
                        },
                        set(value) {
                            prop.set(value)
                        },
                    })
                } else if (prop instanceof Computed) {
                    descriptors.push({
                        key: key,
                        enumerable: true,
                        configurable: true,
                        get() {
                            return prop.get()
                        },
                    })
                }
            }
        }
    }
    for (let i = 0; i < descriptors.length; i++) {
        const descriptor = descriptors[i]
        Object.defineProperty(obj, descriptor.key, descriptor)
    }
    return obj
}
