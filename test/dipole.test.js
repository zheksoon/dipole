const {
    observable,
    Observable,
    computed,
    Computed,
    reaction,
    Reaction,
    tx,
    action,
    utx,
    makeObservable,
    makeObservableProto,
    notify,
    fromGetter,
    when,
    once,
} = require("../dist/index.js");

let trackedUpdatesCounter = new WeakMap();

function trackUpdate(owner) {
    const value = trackedUpdatesCounter.get(owner) || 0;
    trackedUpdatesCounter.set(owner, value + 1);
}

function trackedUpdates(owner) {
    return trackedUpdatesCounter.get(owner) || 0;
}

beforeEach(() => {
    trackedUpdatesCounter = new WeakMap();
});

describe("Observable tests", () => {
    test("creates observable", () => {
        expect(() => {
            observable();
            observable(0);
            observable(1);
            observable(false);
            observable(true);
            observable("hello");
            observable({});
            observable([]);
        }).not.toThrow();
    });

    test("observable creates instance of Observable", () => {
        const o = observable(0);
        expect(o).toBeInstanceOf(Observable);
    });

    test("creates observable and gets value", () => {
        const o1 = observable(42);
        expect(o1.get()).toBe(42);
    });

    test("sets observable value", () => {
        const o1 = observable(0);
        expect(o1.get()).toBe(0);
        o1.set(10);
        expect(o1.get()).toBe(10);
    });

    describe("checkValue option", () => {
        test("create observable with checkValue option", () => {
            const o = observable(0, { checkValue: (a, b) => a == b });
            expect(o._checkValueFn).not.toBeNull();
        });

        test("don't trigger subscribers invalidation when check is true", () => {
            const o1 = observable(0, { checkValue: (a, b) => a == b });
            const c1 = computed(() => {
                trackUpdate(c1);
                return o1.get() * 2;
            });
            c1.get();
            expect(trackedUpdates(c1)).toBe(1);
            // do update
            o1.set(1);
            c1.get();
            expect(trackedUpdates(c1)).toBe(2);
            // no update
            o1.set(1);
            c1.get();
            expect(trackedUpdates(c1)).toBe(2);
        });
    });
});

describe("Computed tests", () => {
    test("creates computed", () => {
        expect(() => {
            computed(() => {});
            computed(function () {});
        }).not.toThrow();
    });

    test("computed creates instance of Computed", () => {
        const c = computed(() => {});
        expect(c).toBeInstanceOf(Computed);
    });

    test("runs computer fn", () => {
        const c1 = computed(() => {
            trackUpdate(c1);
            return 42;
        });

        expect(c1.get()).toBe(42);
        expect(trackedUpdates(c1)).toBe(1);
    });

    test("works with observables", () => {
        const o1 = observable(1);
        const o2 = observable(2);
        const c1 = computed(() => {
            trackUpdate(c1);
            return o1.get() + o2.get();
        });

        expect(c1.get()).toBe(3);
        expect(trackedUpdates(c1)).toBe(1);
    });

    test("caches result", () => {
        const o1 = observable("hello");
        const o2 = observable("world");
        const c1 = computed(() => {
            trackUpdate(c1);
            return o1.get() + " " + o2.get();
        });

        const r1 = c1.get();
        const r2 = c1.get();
        expect(r1).toBe("hello world");
        expect(r1).toBe(r2);
        expect(trackedUpdates(c1)).toBe(1);
    });

    test("invalidated by observable changes", () => {
        const o1 = observable(1);
        const o2 = observable(2);
        const c1 = computed(() => {
            trackUpdate(c1);
            return o1.get() + o2.get();
        });

        c1.get();
        o1.set(10);
        expect(trackedUpdates(c1)).toBe(1); // no calls to the computer fn without need
        expect(c1.get()).toBe(12);
        expect(trackedUpdates(c1)).toBe(2); // call happens only after demand
    });

    test("invalidated observable chain changes 1 (triangle)", () => {
        const o1 = observable(2);
        const c1 = computed(() => {
            trackUpdate(c1);
            return o1.get() * o1.get();
        });
        const c2 = computed(() => {
            trackUpdate(c2);
            return o1.get() * c1.get();
        });

        expect(c2.get()).toBe(2 * 2 * 2);
        expect(trackedUpdates(c1)).toBe(1);
        expect(trackedUpdates(c2)).toBe(1);

        o1.set(3);
        expect(c2.get()).toBe(3 * 3 * 3);
        expect(trackedUpdates(c1)).toBe(2);
        expect(trackedUpdates(c2)).toBe(2);
    });

    test("invalidated by observable chain changes 2 (diamond)", () => {
        const o1 = observable("hi");
        const c1 = computed(() => {
            trackUpdate(c1);
            return o1.get() + " " + o1.get();
        });
        const c2 = computed(() => {
            trackUpdate(c2);
            return o1.get() + "!";
        });
        const c3 = computed(() => {
            trackUpdate(c3);
            return c1.get() + " " + c2.get();
        });

        expect(c3.get()).toBe("hi hi hi!");
        expect(trackedUpdates(c1)).toBe(1);
        expect(trackedUpdates(c2)).toBe(1);
        expect(trackedUpdates(c3)).toBe(1);

        o1.set("wow");
        expect(c3.get()).toBe("wow wow wow!");
        expect(trackedUpdates(c1)).toBe(2);
        expect(trackedUpdates(c2)).toBe(2);
        expect(trackedUpdates(c3)).toBe(2);
    });

    test("invalidated by conditional observable dependence", () => {
        const cond = observable(true);
        const o1 = observable(5);
        const o2 = observable(10);
        const c1 = computed(() => {
            trackUpdate(c1);
            return cond.get() ? o1.get() : o2.get();
        });

        expect(c1.get()).toBe(5);
        expect(trackedUpdates(c1)).toBe(1);

        // dependency - should update
        o1.set(7);
        expect(c1.get()).toBe(7);
        expect(trackedUpdates(c1)).toBe(2);

        // no dependency - shouldn't update
        o2.set(11);
        expect(c1.get()).toBe(7);
        expect(trackedUpdates(c1)).toBe(2);

        // dependency - should update
        cond.set(false);
        expect(c1.get()).toBe(11);
        expect(trackedUpdates(c1)).toBe(3);

        // not a dependency now
        o1.set(5);
        expect(c1.get()).toBe(11);
        expect(trackedUpdates(c1)).toBe(3);

        // dependency
        o2.set(10);
        expect(c1.get()).toBe(10);
        expect(trackedUpdates(c1)).toBe(4);
    });

    test("invalidated by conditional computed dependence", () => {
        const cond0 = observable(false);
        const o1 = observable(5);
        const o2 = observable(10);
        const cond1 = computed(() => {
            return !cond0.get();
        });
        const c1 = computed(() => {
            return o1.get() + 1;
        });
        const c2 = computed(() => {
            return o2.get() + 1;
        });
        const c3 = computed(() => {
            trackUpdate(c3);
            return cond1.get() ? c1.get() : c2.get();
        });

        expect(c3.get()).toBe(6);
        expect(trackedUpdates(c3)).toBe(1);

        // dependency - should update
        o1.set(7);
        expect(c3.get()).toBe(8);
        expect(trackedUpdates(c3)).toBe(2);

        // no dependency - shouldn't update
        o2.set(11);
        expect(c3.get()).toBe(8);
        expect(trackedUpdates(c3)).toBe(2);

        // dependency - should update
        cond0.set(true);
        expect(c3.get()).toBe(12);
        expect(trackedUpdates(c3)).toBe(3);

        // not a dependency now
        o1.set(5);
        expect(c3.get()).toBe(12);
        expect(trackedUpdates(c3)).toBe(3);

        // dependency
        o2.set(10);
        expect(c3.get()).toBe(11);
        expect(trackedUpdates(c3)).toBe(4);
    });

    test("invalidated by conditional computed dependence (many)", () => {
        const obs = new Array(128).fill(0).map((_, i) => observable(i));
        const comp = obs.map((o, i) => computed(() => o.get()));
        const selector = observable(0);
        const value = computed(() => {
            return comp[selector.get()].get();
        });

        for (let i = 0; i < 128; i++) {
            selector.set(i);
            expect(value.get()).toBe(i);

            obs[(i - 1) & 127].set(i - 1);
            expect(value.get()).toBe(i);

            obs[(i + 1) & 127].set(i + 1);
            expect(value.get()).toBe(i);
        }
    });

    test("throws when has recursive dependencies", () => {
        const c1 = computed(() => {
            return c1.get() * 2;
        });

        expect(() => {
            c1.get();
        }).toThrow();
    });

    test("throws when has recursive dependencies", () => {
        const c1 = computed(() => {
            return c2.get() * 2;
        });

        const c2 = computed(() => {
            return c1.get() + 1;
        });

        expect(() => {
            c1.get();
        }).toThrow();

        expect(() => {
            c2.get();
        }).toThrow();
    });

    test("rethrows exceptions", () => {
        const c1 = computed(() => {
            throw new Error("boom!");
        });

        expect(() => {
            c1.get();
        }).toThrow();
    });

    test("restores after exception", () => {
        const o1 = observable(10);
        const c1 = computed(() => {
            if (o1.get() < 0) {
                throw new Error("less than zero");
            }
            return o1.get() * 2;
        });

        expect(c1.get()).toBe(20);

        o1.set(-1);
        expect(() => {
            c1.get();
        }).toThrow();
        // throws the second time as well
        expect(() => {
            c1.get();
        }).toThrow();

        // restores after exception
        o1.set(5);
        expect(c1.get()).toBe(10);
    });

    test("throws when trying to change observable inside of computed", () => {
        const o1 = observable(0);
        const o2 = observable(1);

        const c1 = computed(() => {
            o2.set(o1.get() + o2.get());
        });

        expect(() => {
            c1.get();
        }).toThrow();
    });

    test("destroy method invalidates computed", () => {
        const o = observable(1);
        const c = computed(() => {
            trackUpdate(c);
            return o.get() + 1;
        });
        c.get();
        expect(trackedUpdates(c)).toBe(1);
        expect(o._subscribers.size).toBe(1);
        c.destroy();
        expect(trackedUpdates(c)).toBe(1);
        expect(o._subscribers.size).toBe(0);
        c.get();
        expect(trackedUpdates(c)).toBe(2);
        expect(o._subscribers.size).toBe(1);
    });

    describe("checkValue option", () => {
        const checkValue = (a, b) => a == b;

        test("creates computed with checkValue option", () => {
            const c1 = computed(() => {}, { checkValue });
            expect(c1._checkValueFn).not.toBeNull();
        });

        test("calls reaction when value is changed", () => {
            const o1 = observable(0);
            const c1 = computed(
                () => {
                    trackUpdate(c1);
                    return o1.get() * 2;
                },
                { checkValue }
            );
            const r1 = reaction(() => {
                trackUpdate(r1);
                c1.get();
            });
            r1.run();
            expect(trackedUpdates(c1)).toBe(1);
            expect(trackedUpdates(r1)).toBe(1);
            o1.set(1);
            expect(trackedUpdates(c1)).toBe(2);
            expect(trackedUpdates(r1)).toBe(2);
        });

        test("doesn't call reaction when value is not changed", () => {
            const o1 = observable(0);
            const c1 = computed(
                () => {
                    trackUpdate(c1);
                    return o1.get() * 2;
                },
                { checkValue }
            );
            const r1 = reaction(() => {
                trackUpdate(r1);
                c1.get();
            });
            r1.run();
            expect(trackedUpdates(c1)).toBe(1);
            expect(trackedUpdates(r1)).toBe(1);
            o1.set(0);
            expect(trackedUpdates(c1)).toBe(2); // computed is evaluated, but result is the same
            expect(trackedUpdates(r1)).toBe(1);
        });

        test("chain o -> c -> v -> r", () => {
            const o1 = observable(0);
            const c1 = computed(() => {
                trackUpdate(c1);
                return o1.get() * 2;
            });

            const c2 = computed(
                () => {
                    trackUpdate(c2);
                    return c1.get() * 2;
                },
                { checkValue }
            );

            const r1 = reaction(() => {
                trackUpdate(r1);
                c2.get();
            });
            r1.run();

            expect(trackedUpdates(c1)).toBe(1);
            expect(trackedUpdates(c2)).toBe(1);
            expect(trackedUpdates(r1)).toBe(1);

            o1.set(0); // same value
            expect(trackedUpdates(c1)).toBe(2);
            expect(trackedUpdates(c2)).toBe(2);
            expect(trackedUpdates(r1)).toBe(1);

            o1.set(1); // new value
            expect(trackedUpdates(c1)).toBe(3);
            expect(trackedUpdates(c2)).toBe(3);
            expect(trackedUpdates(r1)).toBe(2);

            o1.set(1); // same value after new value
            expect(trackedUpdates(c1)).toBe(4);
            expect(trackedUpdates(c2)).toBe(4);
            expect(trackedUpdates(r1)).toBe(2);
        });

        test("chain o -> c -> v -> c -> r", () => {
            const o1 = observable(0);
            const c1 = computed(() => {
                trackUpdate(c1);
                return o1.get() * 2;
            });

            const c2 = computed(
                () => {
                    trackUpdate(c2);
                    return c1.get() * 2;
                },
                { checkValue }
            );

            const c3 = computed(() => {
                trackUpdate(c3);
                return c2.get() * 2;
            });

            const r1 = reaction(() => {
                trackUpdate(r1);
                c3.get();
            });
            r1.run();

            expect(trackedUpdates(c1)).toBe(1);
            expect(trackedUpdates(c2)).toBe(1);
            expect(trackedUpdates(c3)).toBe(1);
            expect(trackedUpdates(r1)).toBe(1);

            o1.set(0); // same value
            expect(trackedUpdates(c1)).toBe(2);
            expect(trackedUpdates(c2)).toBe(2);
            expect(trackedUpdates(c3)).toBe(1);
            expect(trackedUpdates(r1)).toBe(1);

            o1.set(1); // new value
            expect(trackedUpdates(c1)).toBe(3);
            expect(trackedUpdates(c2)).toBe(3);
            expect(trackedUpdates(c3)).toBe(2);
            expect(trackedUpdates(r1)).toBe(2);

            o1.set(1); // same value after new value
            expect(trackedUpdates(c1)).toBe(4);
            expect(trackedUpdates(c2)).toBe(4);
            expect(trackedUpdates(c3)).toBe(2);
            expect(trackedUpdates(r1)).toBe(2);
        });

        test("chain o -> v -> v -> r", () => {
            const o1 = observable(0);
            const c1 = computed(
                () => {
                    trackUpdate(c1);
                    return o1.get() * 2;
                },
                { checkValue }
            );

            const c2 = computed(
                () => {
                    trackUpdate(c2);
                    return c1.get() * 2;
                },
                { checkValue }
            );

            const r1 = reaction(() => {
                trackUpdate(r1);
                c2.get();
            });
            r1.run();

            expect(trackedUpdates(c1)).toBe(1);
            expect(trackedUpdates(c2)).toBe(1);
            expect(trackedUpdates(r1)).toBe(1);

            o1.set(0);

            expect(trackedUpdates(c1)).toBe(2);
            expect(trackedUpdates(c2)).toBe(1);
            expect(trackedUpdates(r1)).toBe(1);

            o1.set(1);

            expect(trackedUpdates(c1)).toBe(3);
            expect(trackedUpdates(c2)).toBe(2);
            expect(trackedUpdates(r1)).toBe(2);

            o1.set(1);

            expect(trackedUpdates(c1)).toBe(4);
            expect(trackedUpdates(c2)).toBe(2);
            expect(trackedUpdates(r1)).toBe(2);
        });

        test("chain o -> v -> v -> r (2)", () => {
            const o1 = observable(0);

            const c1 = computed(
                () => {
                    trackUpdate(c1);
                    return Math.abs(o1.get());
                },
                { checkValue }
            );

            const c2 = computed(
                () => {
                    trackUpdate(c2);
                    return Math.abs(c1.get() - 2);
                },
                { checkValue }
            );

            const r1 = reaction(() => {
                trackUpdate(r1);
                c2.get();
            });
            r1.run();

            expect(c2.get()).toBe(2);
            expect(trackedUpdates(c1)).toBe(1);
            expect(trackedUpdates(c2)).toBe(1);
            expect(trackedUpdates(r1)).toBe(1);

            o1.set(1);

            expect(c2.get()).toBe(1);
            expect(trackedUpdates(c1)).toBe(2);
            expect(trackedUpdates(c2)).toBe(2);
            expect(trackedUpdates(r1)).toBe(2);

            o1.set(-1);

            expect(c2.get()).toBe(1);
            expect(trackedUpdates(c1)).toBe(3);
            expect(trackedUpdates(c2)).toBe(2);
            expect(trackedUpdates(r1)).toBe(2);

            o1.set(3);

            expect(c2.get()).toBe(1);
            expect(trackedUpdates(c1)).toBe(4);
            expect(trackedUpdates(c2)).toBe(3);
            expect(trackedUpdates(r1)).toBe(2);

            o1.set(1);

            expect(c2.get()).toBe(1);
            expect(trackedUpdates(c1)).toBe(5);
            expect(trackedUpdates(c2)).toBe(4);
            expect(trackedUpdates(r1)).toBe(2);
        });

        test("transaction test 1", () => {
            const o1 = observable(0);
            const o2 = observable(1);

            const c1 = computed(
                () => {
                    trackUpdate(c1);
                    return o1.get() + o2.get();
                },
                { checkValue }
            );

            const r1 = reaction(() => {
                trackUpdate(r1);
                c1.get();
            });

            r1.run();

            expect(trackedUpdates(r1)).toBe(1);
            expect(trackedUpdates(c1)).toBe(1);

            tx(() => {
                o1.set(1);
                o2.set(2);
            });

            expect(trackedUpdates(r1)).toBe(2);
            expect(trackedUpdates(c1)).toBe(2);

            tx(() => {
                o1.set(5);
                expect(c1.get()).toBe(5 + 2);
                expect(trackedUpdates(c1)).toBe(3);
                expect(trackedUpdates(r1)).toBe(2);
                o2.set(6);
            });

            expect(trackedUpdates(c1)).toBe(4);
            expect(trackedUpdates(r1)).toBe(3);

            // no change to sum
            tx(() => {
                o1.set(6);
                o2.set(5);
            });

            expect(trackedUpdates(c1)).toBe(5);
            expect(trackedUpdates(r1)).toBe(3);
        });

        test("observable branching 1", () => {
            const o1 = observable(0);
            const o2 = observable(1);

            const c1 = computed(
                () => {
                    trackUpdate(c1);
                    return o1.get() * 2;
                },
                { checkValue }
            );

            const c2 = computed(() => {
                trackUpdate(c2);
                return c1.get() + o2.get();
            });

            const r1 = reaction(() => {
                trackUpdate(r1);
                c2.get();
            });
            r1.run();

            expect(trackedUpdates(c1)).toBe(1);
            expect(trackedUpdates(c2)).toBe(1);
            expect(trackedUpdates(r1)).toBe(1);

            o1.set(0);

            expect(trackedUpdates(c1)).toBe(2);
            expect(trackedUpdates(c2)).toBe(1);
            expect(trackedUpdates(r1)).toBe(1);

            o2.set(2);

            expect(trackedUpdates(c1)).toBe(2);
            expect(trackedUpdates(c1)).toBe(2);
            expect(trackedUpdates(c1)).toBe(2);

            o1.set(1);

            expect(trackedUpdates(c1)).toBe(3);
            expect(trackedUpdates(c2)).toBe(3);
            expect(trackedUpdates(r1)).toBe(3);
        });

        test("diamond 1", () => {
            const o1 = observable(0);

            const c1 = computed(
                () => {
                    trackUpdate(c1);
                    return o1.get() * 2;
                },
                { checkValue }
            );

            const c2 = computed(
                () => {
                    trackUpdate(c2);
                    return o1.get() + 1;
                },
                { checkValue }
            );

            const r1 = reaction(() => {
                trackUpdate(r1);
                c1.get();
                c2.get();
            });
            r1.run();

            expect(trackedUpdates(c1)).toBe(1);
            expect(trackedUpdates(c2)).toBe(1);
            expect(trackedUpdates(r1)).toBe(1);

            o1.set(0);

            expect(trackedUpdates(c1)).toBe(2);
            expect(trackedUpdates(c2)).toBe(2);
            expect(trackedUpdates(r1)).toBe(1);

            o1.set(1);

            expect(trackedUpdates(c1)).toBe(3);
            expect(trackedUpdates(c2)).toBe(3);
            expect(trackedUpdates(r1)).toBe(2);
        });

        test("triangle 1", () => {
            const o1 = observable(0);

            const c1 = computed(
                () => {
                    trackUpdate(c1);
                    return o1.get() * 2;
                },
                { checkValue }
            );

            const c2 = computed(
                () => {
                    trackUpdate(c2);
                    return o1.get() + c1.get();
                },
                { checkValue }
            );

            const r1 = reaction(() => {
                trackUpdate(r1);
                c2.get();
            });
            r1.run();

            expect(trackedUpdates(c1)).toBe(1);
            expect(trackedUpdates(c2)).toBe(1);
            expect(trackedUpdates(r1)).toBe(1);

            o1.set(0);

            expect(trackedUpdates(c1)).toBe(2);
            expect(trackedUpdates(c2)).toBe(2);
            expect(trackedUpdates(r1)).toBe(1);
        });

        test("performance (1000 value computed chain)", () => {
            const o1 = observable(0);

            let startValue = o1;
            for (let i = 0; i < 1000; i++) {
                let value = startValue;
                startValue = computed(() => value.get() + 1, { checkValue });
            }

            const r1 = reaction(() => {
                trackUpdate(r1);
                startValue.get();
            });
            r1.run();
            expect(trackedUpdates(r1)).toBe(1);
            expect(startValue.get()).toBe(1000);

            o1.set(0);
            expect(trackedUpdates(r1)).toBe(1);
            expect(startValue.get()).toBe(1000);

            o1.set(1);
            expect(trackedUpdates(r1)).toBe(2);
            expect(startValue.get()).toBe(1001);
        });

        test("unobserved computeds are not recalculating", () => {
            const o1 = observable(0);
            const o2 = observable(1);

            const c1 = computed(
                () => {
                    trackUpdate(c1);
                    return o1.get() + o2.get();
                },
                { checkValue }
            );

            c1.get();
            expect(trackedUpdates(c1)).toBe(1);
            expect(c1._subscribers.size).toBe(0); // unobserved

            o1.set(2);
            expect(trackedUpdates(c1)).toBe(1);
        });
    });
});

describe("Reaction tests", () => {
    test("create reaction", () => {
        expect(() => {
            reaction(() => {});
            reaction(function () {});
        }).not.toThrow();
    });

    test("run simple reaction", () => {
        let out;
        const r1 = reaction(() => {
            trackUpdate(r1);
            out = 1;
        });

        r1.run();
        expect(out).toBe(1);
        expect(trackedUpdates(r1)).toBe(1);
    });

    test("passes this to reaction body", () => {
        let a;
        const obj = { a: 5 };
        const r = reaction(function () {
            a = this.a;
        }, obj);
        r.run();
        expect(a).toBe(5);
    });

    test("passes arguments to reaction body", () => {
        let a;
        const r = reaction((...args) => {
            a = args;
        });
        r.run(1, 2, "a");
        expect(a).toEqual([1, 2, "a"]);
    });

    test("run reaction with observable dependence", () => {
        let out;
        const o1 = observable(1);
        const r1 = reaction(() => {
            trackUpdate(r1);
            out = o1.get() * 2;
        });

        r1.run();
        expect(out).toBe(2);
        expect(trackedUpdates(r1)).toBe(1);

        o1.set(2);
        expect(out).toBe(4);
        expect(trackedUpdates(r1)).toBe(2);
    });

    test("run reaction with computed dependence", () => {
        let out;
        const o1 = observable(1);
        const c1 = computed(() => {
            trackUpdate(c1);
            return o1.get() + 1;
        });
        const r1 = reaction(() => {
            trackUpdate(r1);
            out = c1.get() * 2;
        });

        r1.run();
        expect(out).toBe(4);
        expect(trackedUpdates(r1)).toBe(1);

        o1.set(2);
        expect(out).toBe(6);
        expect(trackedUpdates(r1)).toBe(2);
    });

    test("run reaction with conditional dependence", () => {
        let out;
        const cond = observable(true);
        const o1 = observable("hello");
        const o2 = observable("bye");
        const r1 = reaction(() => {
            trackUpdate(r1);
            out = cond.get() ? o1.get() : o2.get();
        });

        r1.run();
        expect(out).toBe("hello");
        expect(trackedUpdates(r1)).toBe(1);

        // update of tracked variable
        o1.set("well");
        expect(out).toBe("well");
        expect(trackedUpdates(r1)).toBe(2);

        // update of untracked variable
        o2.set("away");
        expect(out).toBe("well");
        expect(trackedUpdates(r1)).toBe(2);

        // update of condition
        cond.set(false);
        expect(out).toBe("away");
        expect(trackedUpdates(r1)).toBe(3);

        // update of untracked variable
        o1.set("hello");
        expect(out).toBe("away");
        expect(trackedUpdates(r1)).toBe(3);

        // update of tracked variable
        o2.set("bye");
        expect(out).toBe("bye");
        expect(trackedUpdates(r1)).toBe(4);
    });

    test("run reaction with conditional computed dependence", () => {
        let out;
        const cond0 = observable(false);
        const cond1 = computed(() => {
            return !cond0.get();
        });
        const o1 = observable("hello");
        const o2 = observable("bye");
        const c1 = computed(() => {
            return o1.get() + "!";
        });
        const c2 = computed(() => {
            return o2.get() + "!";
        });
        const r1 = reaction(() => {
            trackUpdate(r1);
            // console.log('running reaction')
            out = cond1.get() ? c1.get() : c2.get();
        });

        // console.log('first run')
        r1.run();
        expect(out).toBe("hello!");
        expect(trackedUpdates(r1)).toBe(1);

        // console.log('o1 update')
        // update of tracked variable
        o1.set("well");
        expect(out).toBe("well!");
        expect(trackedUpdates(r1)).toBe(2);

        // console.log('o2 update')
        // update of untracked variable
        o2.set("away");
        expect(out).toBe("well!");
        expect(trackedUpdates(r1)).toBe(2);

        // update of condition
        // console.log('cond update')
        cond0.set(true);
        expect(out).toBe("away!");
        expect(trackedUpdates(r1)).toBe(3);

        // update of untracked variable
        // console.log('o1 update')
        o1.set("hello");
        expect(out).toBe("away!");
        expect(trackedUpdates(r1)).toBe(3);

        // update of tracked variable
        // console.log('o2 update')
        o2.set("bye");
        expect(out).toBe("bye!");
        expect(trackedUpdates(r1)).toBe(4);
    });

    describe("reactions run in infinite loop if modify dependant observables", () => {
        test("case 1 (no subsequent subscription in reaction after set()", () => {
            const o1 = observable(0);
            const r1 = reaction(() => {
                if (o1.get() < 50000) {
                    o1.set(o1.get() + 1);
                }
            });

            r1.run();
            expect(o1.get()).toBe(50000);
        });

        test("case 2 (subsequent subscription in reaction after set()", () => {
            const o1 = observable(0);
            const r1 = reaction(() => {
                if (o1.get() < 50000) {
                    o1.set(o1.get() + 1);

                    o1.get();
                }
            });

            r1.run();
            expect(o1.get()).toBe(50000);
        });

        test("case 3 (computed, no subsequent subscription in reaction after set()", () => {
            const o1 = observable(0);
            const c1 = computed(() => o1.get() + 1);
            const r1 = reaction(() => {
                if (c1.get() < 50000) {
                    o1.set(o1.get() + 1);
                }
            });

            r1.run();
            expect(o1.get()).toBe(50000 - 1);
            expect(c1.get()).toBe(50000);
        });

        test("case 4 (computed, subsequent subscription in reaction after set()", () => {
            const o1 = observable(0);
            const c1 = computed(() => o1.get() + 1);
            const r1 = reaction(() => {
                if (c1.get() < 50000) {
                    o1.set(o1.get() + 1);

                    c1.get();
                }
            });

            r1.run();
            expect(o1.get()).toBe(50000 - 1);
            expect(c1.get()).toBe(50000);
        });
    });

    test("should recover after exception", () => {
        const o1 = observable(0);
        const o2 = observable(123);
        const c1 = computed(() => o1.get() + 1);

        let result;
        const r1 = reaction(() => {
            if (c1.get() < 2) {
                throw new Error("Bad!");
            }
            result = o2.get();
        });

        expect(() => {
            r1.run();
        }).toThrow();

        expect(() => {
            o1.set(1); // the reaction doesn't run because it's screwed by exception
        }).not.toThrow();

        expect(() => {
            r1.run(); // the reaction doesn't throw now and recovers from exception
        }).not.toThrow();

        expect(result).toBe(123);

        o2.set(456);
        expect(result).toBe(456);
    });

    test("should not run after destroy", () => {
        let res;
        const o1 = observable(0);
        const r1 = reaction(() => {
            res = o1.get();
        });
        r1.run();
        expect(res).toBe(0);
        r1.destroy();
        o1.set(10);
        expect(res).toBe(0);
        // should be ok again after manual run
        r1.run();
        expect(res).toBe(10);
    });

    test("should throw and be usable after it", () => {
        let res;
        const o1 = observable(1);
        const o2 = observable(2);
        const r = reaction(() => {
            if (o1.get() < 2) {
                throw new Error("too little");
            } else {
                res = o1.get() + o2.get();
            }
        });

        expect(() => r.run()).toThrow();
        expect(() => o1.set(2)).not.toThrow();
        expect(res).toBe(2 + 2);
        expect(() => o2.set(3)).not.toThrow();
        expect(res).toBe(2 + 3);
    });

    test("reaction manager runs instead of body if specified", () => {
        const o = observable(0);
        const manager = jest.fn();
        let c = 0;
        const r = reaction(
            () => {
                c++;
                o.get();
            },
            null,
            manager
        );
        r.run();
        expect(manager).not.toBeCalled();
        expect(c).toBe(1);
        o.set(1);
        // check if maanger was called instead of body
        expect(manager).toBeCalled();
        expect(c).toBe(1);
    });

    describe("nested reactions", () => {
        test("nested reaction is destroyed when parent is destroyed", () => {
            const o1 = observable(1);
            const o2 = observable(2);
            let r2;
            const r1 = reaction(() => {
                o1.get();
                trackUpdate(r1);
                r2 = reaction(() => {
                    o2.get();
                    trackUpdate(r2);
                });
                r2.run();
            });
            r1.run();

            expect(trackedUpdates(r1)).toBe(1);
            expect(trackedUpdates(r2)).toBe(1);

            o2.set(4);
            expect(trackedUpdates(r1)).toBe(1);
            expect(trackedUpdates(r2)).toBe(2);

            r1.destroy();

            // nested reaction doesn't react to dependency updates, so destroyed
            o2.set(5);
            expect(trackedUpdates(r2)).toBe(2);

            // parent reaction is destroyed as well
            o1.set(2);
            expect(trackedUpdates(r1)).toBe(1);
        });

        test("nested reaction is destroyed when parent runs", () => {
            const o1 = observable(1);
            const o2 = observable(2);
            let r2;
            const r1 = reaction(() => {
                o1.get();
                trackUpdate(r1);
                // create nested reaction only for the first time
                if (!r2) {
                    r2 = reaction(() => {
                        o2.get();
                        trackUpdate(r2);
                    });
                    r2.run();
                }
            });
            r1.run();

            expect(trackedUpdates(r1)).toBe(1);
            expect(trackedUpdates(r2)).toBe(1);

            // nested reaction reacts
            o2.notify();
            expect(trackedUpdates(r2)).toBe(2);

            // notify parent
            o1.notify();
            expect(trackedUpdates(r1)).toBe(2);

            // doesn't react anymore
            o2.notify();
            expect(trackedUpdates(r2)).toBe(2);
        });

        test("computed context is not perceived as parent", () => {
            const c = computed(() => reaction(() => {}));

            expect(() => c.get()).not.toThrow();

            const r = c.get();

            expect(() => r.run()).not.toThrow();
        });

        test("reaction doesn't get parent when created inside utx", () => {
            const o1 = observable(1);
            const o2 = observable(2);
            let r2;
            const r1 = reaction(() => {
                o1.get();
                trackUpdate(r1);
                if (!r2) {
                    r2 = utx(() =>
                        reaction(() => {
                            o2.get();
                            trackUpdate(r2);
                        })
                    );
                    r2.run();
                }
            });
            r1.run();

            expect(trackedUpdates(r1)).toBe(1);
            expect(trackedUpdates(r2)).toBe(1);

            // run parent
            o1.notify();
            expect(trackedUpdates(r1)).toBe(2);

            // child don't get destroyed when parent runs
            o2.notify();
            expect(trackedUpdates(r2)).toBe(2);
        });

        test("nested reaction is doesn't run when parent runs", () => {
            const o1 = observable(1);
            const o2 = observable(2);
            let r2;
            const r1 = reaction(() => {
                o1.get();
                trackUpdate(r1);
                // create nested reaction only for the first time
                if (!r2) {
                    r2 = reaction(() => {
                        o1.get();
                        o2.get();
                        trackUpdate(r2);
                    });
                    r2.run();
                }
            });
            r1.run();

            expect(trackedUpdates(r1)).toBe(1);
            expect(trackedUpdates(r2)).toBe(1);

            // nested reaction reacts
            o2.notify();
            expect(trackedUpdates(r2)).toBe(2);

            // notify parent and child
            o1.notify();
            expect(trackedUpdates(r1)).toBe(2);
            // child didn't run
            expect(trackedUpdates(r2)).toBe(2);

            // doesn't react anymore
            o2.notify();
            expect(trackedUpdates(r2)).toBe(2);
        });
    });

    describe("utility tests", () => {
        test("when() runs reaction each time condition is true", () => {
            const t = {};
            const o1 = observable(false);

            const r = when(
                () => o1.get(),
                () => trackUpdate(t)
            );

            expect(trackedUpdates(t)).toBe(0);

            o1.set(true);
            expect(trackedUpdates(t)).toBe(1);

            o1.set(false);
            expect(trackedUpdates(t)).toBe(1);

            o1.set(true);
            expect(trackedUpdates(t)).toBe(2);

            // doesn't react after destroy
            r.destroy();
            o1.set(true);
            expect(trackedUpdates(t)).toBe(2);
        });

        test("when() runs reaction after creation if condition is true", () => {
            const t = {};
            const o1 = observable(true);

            const r = when(
                () => o1.get(),
                () => trackUpdate(t)
            );

            expect(trackedUpdates(t)).toBe(1);

            o1.set(true);
            expect(trackedUpdates(t)).toBe(2);
        });

        test("once() runs reaction once if condition is true", () => {
            const t = {};
            const o1 = observable(false);

            const r = once(
                () => o1.get(),
                () => trackUpdate(t)
            );

            expect(trackedUpdates(t)).toBe(0);

            o1.set(true);
            expect(trackedUpdates(t)).toBe(1);

            o1.set(false);
            expect(trackedUpdates(t)).toBe(1);

            // doesn't run anymore
            o1.set(true);
            expect(trackedUpdates(t)).toBe(1);
        });

        test("once() runs reaction once after creation if condition is true", () => {
            const t = {};
            const o1 = observable(true);

            const r = once(
                () => o1.get(),
                () => trackUpdate(t)
            );

            expect(trackedUpdates(t)).toBe(1);

            // doesn't run anymore
            o1.set(true);
            expect(trackedUpdates(t)).toBe(1);
        });

        test("once() doesn't run if destroyed", () => {
            const t = {};
            const o1 = observable(false);

            const r = once(
                () => o1.get(),
                () => trackUpdate(t)
            );

            r.destroy();

            // doesn't run anymore
            o1.set(true);
            expect(trackedUpdates(t)).toBe(0);
        });

        test("once() doesn't run in infinite loop if changes its dependencies", () => {
            const o1 = observable(false);
            let cnt = 0;
            const r = once(
                () => o1.get(),
                () => {
                    if (++cnt < 1000) {
                        trackUpdate(r);
                        o1.set(true);
                    }
                }
            );
            expect(trackedUpdates(r)).toBe(0);
            o1.set(true);
            expect(trackedUpdates(r)).toBe(1);
        });
    });
});

describe("Transactions tests", () => {
    test("basic", () => {
        let out;
        const o1 = observable(0);
        const r1 = reaction(() => {
            out = o1.get();
        }).run();

        expect(out).toBe(0);

        tx(() => {
            o1.set(1);
        });

        expect(out).toBe(1);
    });

    test("two mutations", () => {
        let out;
        const o1 = observable(1);
        const o2 = observable(2);
        const r1 = reaction(() => {
            trackUpdate(r1);
            out = o1.get() + o2.get();
        });

        r1.run();

        expect(out).toBe(3);
        expect(trackedUpdates(r1)).toBe(1);

        tx(() => {
            o1.set(3);
            o2.set(4);
        });

        expect(out).toBe(7);
        expect(trackedUpdates(r1)).toBe(2);
    });

    test("get computed value inside a tx", () => {
        let out;
        const o1 = observable(true);
        const o2 = observable(3);
        const o3 = observable(4);
        const o4 = observable(10);

        const c1 = computed(() => {
            trackUpdate(c1);
            return o1.get() ? o2.get() : o3.get();
        });

        const r1 = reaction(() => {
            trackUpdate(r1);
            out = c1.get() + o4.get();
        });

        r1.run();

        expect(out).toBe(3 + 10);
        expect(trackedUpdates(r1)).toBe(1);
        expect(trackedUpdates(c1)).toBe(1);

        tx(() => {
            o1.set(false);
            o3.set(5);

            expect(c1.get()).toBe(5);
            expect(trackedUpdates(c1)).toBe(2);

            o2.set(4); // no change
            expect(c1.get()).toBe(5);
            expect(trackedUpdates(c1)).toBe(2);

            o4.set(c1.get());
        });

        expect(out).toBe(5 + 5);
        expect(trackedUpdates(r1)).toBe(2);
    });
});

describe("Actions and untracked transactions", () => {
    test("Action creates usable function", () => {
        const ac = action(() => {});
        expect(() => ac()).not.toThrow();
    });

    test("Action passes params and this to body function", () => {
        let actionParams;
        const ac = action((...params) => {
            actionParams = params;
        });
        ac(1, 2, 3);
        expect(actionParams).toEqual([1, 2, 3]);

        let actionThis;
        const host = {
            ac: action(function () {
                actionThis = this;
            }),
        };
        host.ac();
        expect(actionThis).toBe(host);
    });

    test("Actions work like transactions", () => {
        const o1 = observable(1);
        const o2 = observable(2);
        const ac = action(() => {
            o1.set(o1.get() + 1);
            o2.set(o2.get() + 1);
        });
        const r = reaction(() => {
            o1.get();
            o2.get();
            trackUpdate(r);
        });
        r.run();
        ac();
        expect(trackedUpdates(r)).toBe(2);
    });

    test("Actions are untracked", () => {
        const o1 = observable(1);
        const o2 = observable(2);
        const ac = action(() => o1.set(o1.get() + 1));
        const r = reaction(() => {
            o2.get();
            ac();
            trackUpdate(r);
        });
        r.run();
        expect(trackedUpdates(r)).toBe(1);
        o2.set(10); // change reaction dep
        expect(trackedUpdates(r)).toBe(2);
        o1.set(20); // change observable from action body
        expect(trackedUpdates(r)).toBe(2);
    });

    test("Untracked transactions (utx) work like transactions", () => {
        const o1 = observable(1);
        const o2 = observable(2);
        const r = reaction(() => {
            o1.get();
            o2.get();
            trackUpdate(r);
        });
        r.run();
        expect(trackedUpdates(r)).toBe(1);
        utx(() => {
            o1.set(o1.get() + 1);
            o2.set(o2.get() + 1);
        });
        expect(trackedUpdates(r)).toBe(2);
    });

    test("Untracked transactions (utx) are untracked", () => {
        const o1 = observable(1);
        const o2 = observable(2);
        const r = reaction(() => {
            o2.get();
            utx(() => o1.set(o1.get() + 1));
            trackUpdate(r);
        });
        r.run();
        expect(trackedUpdates(r)).toBe(1);
        o2.set(10); // change reaction dep
        expect(trackedUpdates(r)).toBe(2);
        o1.set(20); // change observable from action body
        expect(trackedUpdates(r)).toBe(2);
    });
});

describe("makeObservable and related functions", () => {
    describe("makeObservable", () => {
        test("makeObservable dosn't throw for empty object", () => {
            expect(() => makeObservable({})).not.toThrow();
            class T {
                constructor() {
                    makeObservable(this);
                }
            }
            expect(() => new T()).not.toThrow();
        });

        test("makeObservable converts observable and computed on plain object", () => {
            const o = makeObservable({
                a: observable(1),
                b: computed(() => o.a + 1),
            });
            let c;
            const r = reaction(() => {
                c = o.b;
            });
            expect(() => r.run()).not.toThrow();
            expect(c).toBe(2);
            o.a = 2;
            expect(c).toBe(3);
        });

        test("makeObservable converts observable and computed on class objects", () => {
            class C {
                a = observable(1);
                b = computed(() => this.a + 1);

                constructor() {
                    makeObservable(this);
                }
            }
            const o = new C();
            let c;
            const r = reaction(() => {
                c = o.b;
            });
            expect(() => r.run()).not.toThrow();
            expect(c).toBe(2);
            o.a = 2;
            expect(c).toBe(3);
        });

        test("makeObservable only affects own properrties", () => {
            const o = makeObservable({
                a: observable(1),
                __proto__: {
                    b: observable(2),
                },
            });
            expect(o.a).toBe(1);
            expect(o.b).toBeInstanceOf(Observable); // o.b is on proto, so don't get converted
        });

        test("makeObservable doesn't add setter for computed", () => {
            const o = makeObservable({
                a: observable(1),
                b: computed(() => o.a + 1),
            });
            expect(() => (o.b = 20)).not.toThrow();
            // check o.b is still a computed
            expect(o.b).toBe(2);
            o.a = 5;
            expect(o.b).toBe(6);
        });

        test("makeObservable doesn't change behaviour if applied twice (objects)", () => {
            const o = makeObservable(
                makeObservable({
                    a: observable(1),
                    b: computed(() => o.a + 1),
                })
            );

            let c;
            const r = reaction(() => {
                c = o.b;
            });
            expect(() => r.run()).not.toThrow();
            expect(c).toBe(2);
            o.a = 2;
            expect(c).toBe(3);
        });

        test("makeObservable doesn't change behaviour if applied twice (classes inheritance)", () => {
            class A {
                a = observable(1);
                b = computed(() => this.a + 1);

                constructor() {
                    makeObservable(this);
                }
            }
            class B extends A {
                c = computed(() => this.a + this.b);

                constructor() {
                    super();
                    makeObservable(this);
                }
            }
            const o = new B();
            let c;
            const r = reaction(() => {
                c = o.c;
            });
            expect(() => r.run()).not.toThrow();
            expect(c).toBe(3);
            o.a = 2;
            expect(c).toBe(5);
        });

        test("makeObservable doesn't execute getters", () => {
            let count = 0;
            const o = makeObservable({
                get a() {
                    return (count += 1);
                },
            });
            expect(count).toBe(0);
        });
    });

    describe("makeObservableProto", () => {
        test("doesn't throw on empty object", () => {
            class A {
                constructor() {
                    this.a = 1;
                    makeObservableProto(this, A, {});
                }
            }

            expect(() => new A()).not.toThrow();
        });

        test("doesn't add own enumerable properties on object", () => {
            class A {
                constructor() {
                    this.a = 1;
                    makeObservableProto(this, A, {
                        b: observable(2),
                        c: computed(() => this.a + this.b),
                    });
                }
            }

            const obj = new A();
            const keys = Object.keys(obj);

            expect(keys).toStrictEqual(["a"]);
            expect(obj.a).toBe(1);
            expect(obj.b).toBe(2);
            expect(obj.c).toBe(3);
        });

        test("creates getters and setters for observables", () => {
            class A {
                constructor() {
                    makeObservableProto(this, A, {
                        a: observable(1),
                        b: observable(2),
                    });
                }
            }

            const obj = new A();

            let res;
            const r = reaction(() => {
                res = obj.a + obj.b;
            });
            r.run();

            expect(res).toBe(3);

            obj.a = 2;
            expect(res).toBe(4);

            obj.b = 3;
            expect(res).toBe(5);
        });

        test("creates getters for computed values", () => {
            class A {
                constructor() {
                    makeObservableProto(this, A, {
                        a: observable(1),
                        b: observable(2),
                        c: computed(() => {
                            return this.a + this.b;
                        }),
                    });
                }
            }

            const obj = new A();

            let res;
            const r = reaction(() => {
                res = obj.c;
            });
            r.run();

            expect(res).toBe(3);

            obj.a = 4;
            expect(res).toBe(6);

            expect(() => (obj.c = 100)).not.toThrow();
            expect(res).toBe(6);
        });

        test("works in inheritance case", () => {
            class A {
                constructor() {
                    this.a = 1;
                    makeObservableProto(this, A, {
                        b: observable(2),
                        c: computed(() => this.a + this.b),
                    });
                }
            }

            class B extends A {
                constructor() {
                    super();
                    this.d = 4;
                    makeObservableProto(this, B, {
                        e: observable(5),
                        f: computed(() => this.e + this.c),
                    });
                }
            }

            const a = new A();
            const b = new B();

            expect(Object.keys(a)).toStrictEqual(["a"]);
            expect(Object.keys(b)).toStrictEqual(["a", "d"]);

            expect(a.b).toBe(2);
            expect(a.c).toBe(3);
            expect(a.d).toBe(undefined);
            expect(a.e).toBe(undefined);
            expect(a.f).toBe(undefined);

            expect(b.b).toBe(2);
            expect(b.c).toBe(3);
            expect(b.d).toBe(4);
            expect(b.e).toBe(5);
            expect(b.f).toBe(8);
        });

        test("throws when object value is not observable or computed instance", () => {
            class A {
                constructor() {
                    makeObservableProto(this, A, {
                        a: observable(1),
                        b: computed(() => this.a),
                        c: "hello kitty",
                    });
                }
            }

            expect(() => new A()).toThrow();
        });

        test("Work with symbols", () => {
            const S = Symbol("test");
            class A {
                constructor() {
                    makeObservableProto(this, A, {
                        a: observable(1),
                        b: computed(() => this.a + 1),
                        [S]: computed(() => this.a + this.b),
                    })
                }
            }

            const a = new A();

            expect(a[S]).toBe(3);
        })
    });

    describe("notify", () => {
        test("notify doesn't throw on empty thunk fn", () => {
            expect(() => notify(() => {})).not.toThrow();
        });

        test("notify calls .notify() on observables accessed in thunk fn", () => {
            const o = makeObservable({
                a: observable(1),
                b: observable(2),
            });
            const c = computed(() => {
                trackUpdate(c);
                return o.a + 1;
            });
            const d = computed(() => {
                trackUpdate(d);
                return o.b + 1;
            });
            expect(c.get()).toBe(2);
            expect(trackedUpdates(c)).toBe(1);
            expect(d.get()).toBe(3);
            expect(trackedUpdates(d)).toBe(1);
            // repeat
            expect(c.get()).toBe(2);
            expect(trackedUpdates(c)).toBe(1);
            expect(d.get()).toBe(3);
            expect(trackedUpdates(d)).toBe(1);
            // notify both
            notify(() => (o.a, o.b));
            // check
            expect(c.get()).toBe(2);
            expect(trackedUpdates(c)).toBe(2);
            expect(d.get()).toBe(3);
            expect(trackedUpdates(d)).toBe(2);
            // notify only a
            notify(() => o.a);
            // check
            expect(c.get()).toBe(2);
            expect(trackedUpdates(c)).toBe(3);
            expect(d.get()).toBe(3);
            expect(trackedUpdates(d)).toBe(2);
        });

        test("notify throws on computed notify", () => {
            const o = observable(1);
            const c = computed(() => o.get() + 1);

            expect(() => notify(() => c.get())).toThrow();
            expect(() => notify(() => o.get())).not.toThrow();
        });
    });

    describe("fromGetter", () => {
        test("fromGetter doesn't throw on empty thunk fn", () => {
            expect(() => fromGetter(() => {})).not.toThrow();
            expect(fromGetter(() => {})).toBe(undefined);
        });

        test("fromGetter returns observable or computed instance accessed on thunk fn", () => {
            const o = observable(1);
            const c = computed(() => o.get() + 1);
            expect(fromGetter(() => o.get())).toBe(o);
            expect(fromGetter(() => c.get())).toBe(c);
        });

        test("fromGetter returns observable or computed instance accessed on thunk fn (makeObservable)", () => {
            const o = observable(1);
            const c = computed(() => o.get() + 1);
            const oo = makeObservable({ o, c });
            expect(fromGetter(() => oo.o)).toBe(o);
            expect(fromGetter(() => oo.c)).toBe(c);
        });

        test("fromGetter returns latest accessed observable in thunk fn", () => {
            const o1 = observable(1);
            const o2 = observable(2);
            expect(fromGetter(() => (o1.get(), o2.get()))).toBe(o2);
        });
    });
});

describe("Background subscribers check", () => {
    test("it unsubscribers computed from subscriptions when there is no subscribers", async () => {
        const o = observable(1);
        const c = computed(() => o.get() * 2);

        const flag = observable(true);
        const r = reaction(() => {
            if (flag.get()) {
                c.get();
            }
        });
        r.run();

        expect(c._subscribers.size).toBe(1);
        expect(o._subscribers.size).toBe(1);

        flag.set(false);
        expect(c._subscribers.size).toBe(0);
        expect(o._subscribers.size).toBe(1); // computed is still subscribed

        await new Promise((resolve) => setTimeout(resolve, 1500));

        expect(c._subscribers.size).toBe(0);
        expect(o._subscribers.size).toBe(0); // computed is unsubscribed
    });
});
