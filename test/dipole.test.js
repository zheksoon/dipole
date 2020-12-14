const { Observable, Computed, Reaction, tx } = require('../dist/index.js');


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
})


describe('Observable tests', () => {
    test('creates new observable', () => {
        expect(() => {
            new Observable();
            new Observable(0);
            new Observable(1);
            new Observable(false);
            new Observable(true);
            new Observable('hello');
            new Observable({});
            new Observable([]);
        }).not.toThrow();
    })

    test('creates new observable and gets value', () => {
        const o1 = new Observable(42);
        expect(o1.get()).toBe(42);
    })

    test('sets observable value', () => {
        const o1 = new Observable(0);
        expect(o1.get()).toBe(0);
        o1.set(10);
        expect(o1.get()).toBe(10);
    })
})

describe('Computed tests', () => {
    test('creates computed', () => {
        expect(() => {
            new Computed(() => {});
            new Computed(function() {});
        }).not.toThrow();
    })

    test('runs computer fn', () => {
        const c1 = new Computed(self => {
            trackUpdate(c1);
            return 42;
        });

        expect(c1.get()).toBe(42);
        expect(trackedUpdates(c1)).toBe(1);
    })

    test('works with observables', () => {
        const o1 = new Observable(1);
        const o2 = new Observable(2);
        const c1 = new Computed(self => {
            trackUpdate(c1);
            return o1.get() + o2.get();
        })

        expect(c1.get()).toBe(3);
        expect(trackedUpdates(c1)).toBe(1);
    })

    test('caches result', () => {
        const o1 = new Observable('hello');
        const o2 = new Observable('world');
        const c1 = new Computed(self => {
            trackUpdate(c1);
            return o1.get() + ' ' + o2.get();
        })

        const r1 = c1.get()
        const r2 = c1.get();
        expect(r1).toBe('hello world');
        expect(r1).toBe(r2);
        expect(trackedUpdates(c1)).toBe(1);
    })

    test('invalidated by observable changes', () => {
        const o1 = new Observable(1);
        const o2 = new Observable(2);
        const c1 = new Computed(self => {
            trackUpdate(c1);
            return o1.get() + o2.get();
        })

        c1.get();
        o1.set(10);
        expect(trackedUpdates(c1)).toBe(1); // no calls to the computer fn without need
        expect(c1.get()).toBe(12);
        expect(trackedUpdates(c1)).toBe(2); // call happens only after demand
    })

    test('invalidated observable chain changes 1 (triangle)', () => {
        const o1 = new Observable(2);
        const c1 = new Computed(self => {
            trackUpdate(c1);
            return o1.get() * o1.get();
        })
        const c2 = new Computed(self => {
            trackUpdate(c2);
            return o1.get() * c1.get();
        })

        expect(c2.get()).toBe(2 * 2 * 2);
        expect(trackedUpdates(c1)).toBe(1);
        expect(trackedUpdates(c2)).toBe(1);

        o1.set(3);
        expect(c2.get()).toBe(3 * 3 * 3);
        expect(trackedUpdates(c1)).toBe(2);
        expect(trackedUpdates(c2)).toBe(2);
    })

    test('invalidated by observable chain changes 2 (diamond)', () => {
        const o1 = new Observable('hi');
        const c1 = new Computed(self => {
            trackUpdate(c1);
            return o1.get() + ' ' + o1.get();
        })
        const c2 = new Computed(self => {
            trackUpdate(c2);
            return o1.get() + '!';
        })
        const c3 = new Computed(self => {
            trackUpdate(c3);
            return c1.get() + ' ' + c2.get();
        })

        expect(c3.get()).toBe('hi hi hi!');
        expect(trackedUpdates(c1)).toBe(1);
        expect(trackedUpdates(c2)).toBe(1);
        expect(trackedUpdates(c3)).toBe(1);

        o1.set('wow');
        expect(c3.get()).toBe('wow wow wow!');
        expect(trackedUpdates(c1)).toBe(2);
        expect(trackedUpdates(c2)).toBe(2);
        expect(trackedUpdates(c3)).toBe(2);
    })

    test('invalidated by conditional observable dependence', () => {
        const cond = new Observable(true);
        const o1 = new Observable(5);
        const o2 = new Observable(10);
        const c1 = new Computed(() => {
            trackUpdate(c1);
            return cond.get() ? o1.get() : o2.get();
        })

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
    })

    test('invalidated by conditional computed dependence', () => {
        const cond0 = new Observable(false);
        const o1 = new Observable(5);
        const o2 = new Observable(10);
        const cond1 = new Computed(() => {
            return !cond0.get();
        });
        const c1 = new Computed(() => {
            return o1.get() + 1;
        })
        const c2 = new Computed(() => {
            return o2.get() + 1;
        })
        const c3 = new Computed(() => {
            trackUpdate(c3);
            return cond1.get() ? c1.get() : c2.get();
        })

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
    })

    test('invalidated by conditional computed dependence (many)', () => {
        const obs = new Array(128).fill(0).map((_, i) => new Observable(i));
        const comp = obs.map((o, i) => new Computed(() => o.get()));
        const selector = new Observable(0);
        const value = new Computed(() => {
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
    })

    test('throws when has recursive dependencies', () => {
        const c1 = new Computed(() => {
            return c1.get() * 2;
        });

        expect(() => {
            c1.get();
        }).toThrow();
    })

    test('throws when has recursive dependencies', () => {
        const c1 = new Computed(() => {
            return c2.get() * 2;
        });

        const c2 = new Computed(() => {
            return c1.get() + 1;
        });

        expect(() => {
            c1.get();
        }).toThrow();

        expect(() => {
            c2.get();
        }).toThrow();
    })

    test('rethrows exceptions', () => {
        const c1 = new Computed(() => {
            throw new Error('boom!');
        })

        expect(() => {
            c1.get()
        }).toThrow();
    })

    test('restores after exception', () => {
        const o1 = new Observable(10);
        const c1 = new Computed(() => {
            if (o1.get() < 0) {
                throw new Error('less than zero');
            }
            return o1.get() * 2;
        });

        expect(c1.get()).toBe(20);

        o1.set(-1);
        expect(() => {
            c1.get()
        }).toThrow();
        // throws the second time as well
        expect(() => {
            c1.get()
        }).toThrow();

        // restores after exception
        o1.set(5);
        expect(c1.get()).toBe(10);
    });

    test('throws when trying to change observable inside of computed', () => {
        const o1 = new Observable(0);
        const o2 = new Observable(1);

        const c1 = new Computed(() => {
            o2.set(o1.get() + o2.get());
        });

        expect(() => {
            c1.get();
        }).toThrow();
    })
});

describe('Reaction tests', () => {
    test('create reaction', () => {
        expect(() => {
            new Reaction(() => {});
            new Reaction(function() {})
        }).not.toThrow();
    })

    test('run simple reaction', () => {
        let out;
        const r1 = new Reaction(() => {
            trackUpdate(r1);
            out = 1;
        });

        r1.run();
        expect(out).toBe(1);
        expect(trackedUpdates(r1)).toBe(1);
    })

    test('run reaction with observable dependence', () => {
        let out;
        const o1 = new Observable(1);
        const r1 = new Reaction(() => {
            trackUpdate(r1);
            out = o1.get() * 2;
        });

        r1.run();
        expect(out).toBe(2);
        expect(trackedUpdates(r1)).toBe(1);

        o1.set(2);
        expect(out).toBe(4);
        expect(trackedUpdates(r1)).toBe(2);
    })

    test('run reaction with computed dependence', () => {
        let out;
        const o1 = new Observable(1);
        const c1 = new Computed(() => {
            trackUpdate(c1);
            return o1.get() + 1;
        })
        const r1 = new Reaction(() => {
            trackUpdate(r1);
            out = c1.get() * 2;
        });

        r1.run();
        expect(out).toBe(4);
        expect(trackedUpdates(r1)).toBe(1);

        o1.set(2);
        expect(out).toBe(6);
        expect(trackedUpdates(r1)).toBe(2);
    })

    test('run reaction with conditional dependence', () => {
        let out ;
        const cond = new Observable(true);
        const o1 = new Observable('hello');
        const o2 = new Observable('bye');
        const r1 = new Reaction(() => {
            trackUpdate(r1);
            out = cond.get() ? o1.get() : o2.get();
        });

        r1.run();
        expect(out).toBe('hello');
        expect(trackedUpdates(r1)).toBe(1);

        // update of tracked variable
        o1.set('well');
        expect(out).toBe('well');
        expect(trackedUpdates(r1)).toBe(2);

        // update of untracked variable
        o2.set('away');
        expect(out).toBe('well');
        expect(trackedUpdates(r1)).toBe(2);

        // update of condition
        cond.set(false);
        expect(out).toBe('away');
        expect(trackedUpdates(r1)).toBe(3);

        // update of untracked variable
        o1.set('hello');
        expect(out).toBe('away');
        expect(trackedUpdates(r1)).toBe(3);

        // update of tracked variable
        o2.set('bye');
        expect(out).toBe('bye');
        expect(trackedUpdates(r1)).toBe(4);
    })

    test('run reaction with conditional computed dependence', () => {
        let out ;
        const cond0 = new Observable(false);
        const cond1 = new Computed(() => {
            return !cond0.get();
        })
        const o1 = new Observable('hello');
        const o2 = new Observable('bye');
        const c1 = new Computed(() => {
            return o1.get() + '!';
        })
        const c2 = new Computed(() => {
            return o2.get() + '!';
        })
        const r1 = new Reaction(() => {
            trackUpdate(r1);
            // console.log('running reaction')
            out = cond1.get() ? c1.get() : c2.get();
        });

        // console.log('first run')
        r1.run();
        expect(out).toBe('hello!');
        expect(trackedUpdates(r1)).toBe(1);

        // console.log('o1 update')
        // update of tracked variable
        o1.set('well');
        expect(out).toBe('well!');
        expect(trackedUpdates(r1)).toBe(2);

        // console.log('o2 update')
        // update of untracked variable
        o2.set('away');
        expect(out).toBe('well!');
        expect(trackedUpdates(r1)).toBe(2);

        // update of condition
        // console.log('cond update')
        cond0.set(true);
        expect(out).toBe('away!');
        expect(trackedUpdates(r1)).toBe(3);

        // update of untracked variable
        // console.log('o1 update')
        o1.set('hello');
        expect(out).toBe('away!');
        expect(trackedUpdates(r1)).toBe(3);

        // update of tracked variable
        // console.log('o2 update')
        o2.set('bye');
        expect(out).toBe('bye!');
        expect(trackedUpdates(r1)).toBe(4);
    });

    describe('reactions run in infinite loop if modify dependant observables', () => {
        test('case 1 (no subsequent subscription in reaction after set()', () => {
            const o1 = new Observable(0);
            const r1 = new Reaction(() => {
                if (o1.get() < 50000) {
                    o1.set(o1.get() + 1);
                }
            })

            r1.run();
            expect(o1.get()).toBe(50000);
        });

        test('case 2 (subsequent subscription in reaction after set()', () => {
            const o1 = new Observable(0);
            const r1 = new Reaction(() => {
                if (o1.get() < 50000) {
                    o1.set(o1.get() + 1);

                    o1.get();
                }
            })

            r1.run();
            expect(o1.get()).toBe(50000);
        });

        test('case 3 (computed, no subsequent subscription in reaction after set()', () => {
            const o1 = new Observable(0);
            const c1 = new Computed(() => o1.get() + 1);
            const r1 = new Reaction(() => {
                if (c1.get() < 50000) {
                    o1.set(o1.get() + 1);
                }
            })

            r1.run();
            expect(o1.get()).toBe(50000 - 1);
            expect(c1.get()).toBe(50000);
        });

        test('case 4 (computed, subsequent subscription in reaction after set()', () => {
            const o1 = new Observable(0);
            const c1 = new Computed(() => o1.get() + 1);
            const r1 = new Reaction(() => {
                if (c1.get() < 50000) {
                    o1.set(o1.get() + 1);

                    c1.get();
                }
            })

            r1.run();
            expect(o1.get()).toBe(50000 - 1);
            expect(c1.get()).toBe(50000);
        });        
    });

    test('should recover after exception', () => {
        const o1 = new Observable(0);
        const o2 = new Observable(123);
        const c1 = new Computed(() => o1.get() + 1);

        let result;
        const r1 = new Reaction(() => {
            if (c1.get() < 2) {
                throw new Error('Bad!');
            }
            result = o2.get();
        });

        expect(() => {
            r1.run();
        }).toThrow();

        expect(() => {
            o1.set(1);  // the reaction doesn't run because it's screwed by exception
        }).not.toThrow();

        expect(() => {
            r1.run();   // the reaction doesn't throw now and recovers from exception
        }).not.toThrow();

        expect(result).toBe(123);

        o2.set(456);
        expect(result).toBe(456);
    });

    test('should not run after destroy', () => {
        let res;
        const o1 = new Observable(0);
        const r1 = new Reaction(() => {
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

    test('should throw and be usable after it', () => {
        let res;
        const o1 = new Observable(1);
        const o2 = new Observable(2);
        const r = new Reaction(() => {
            if (o1.get() < 2) {
                throw new Error('too little');
            } else {
                res = o1.get() + o2.get()
            }
        });

        expect(() => r.run()).toThrow();
        expect(() => o1.set(2)).not.toThrow();
        expect(res).toBe(2 + 2);
        expect(() => o2.set(3)).not.toThrow();
        expect(res).toBe(2 + 3);
    })
})

describe('Transactions tests', () => {
    test('basic', () => {
        let out;
        const o1 = new Observable(0);
        const r1 = new Reaction(() => {
            out = o1.get();
        }).run();

        expect(out).toBe(0);

        tx(() => {
            o1.set(1);
        });

        expect(out).toBe(1);
    })

    test('two mutations', () => {
        let out;
        const o1 = new Observable(1);
        const o2 = new Observable(2);
        const r1 = new Reaction(() => {
            trackUpdate(r1);
            out = o1.get() + o2.get();
        })

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

    test('get computed value inside a tx', () => {
        let out;
        const o1 = new Observable(true);
        const o2 = new Observable(3);
        const o3 = new Observable(4);
        const o4 = new Observable(10);

        const c1 = new Computed(() => {
            trackUpdate(c1);
            return o1.get() ? o2.get() : o3.get();
        });

        const r1 = new Reaction(() => {
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

            o2.set(4);  // no change
            expect(c1.get()).toBe(5);
            expect(trackedUpdates(c1)).toBe(2);

            o4.set(c1.get());            
        })

        expect(out).toBe(5 + 5);
        expect(trackedUpdates(r1)).toBe(2);
    })
})