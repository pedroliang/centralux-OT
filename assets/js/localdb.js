/**
 * LocalDB — IndexedDB persistence layer with Supabase sync
 * 
 * Write path: UI → IndexedDB (instant) → Supabase (background)
 * Read path:  UI ← IndexedDB (instant), Supabase → IndexedDB (background pull)
 * 
 * Usage:
 *   await LocalDB.init(supabaseClient);
 *   const orders = await LocalDB.orders.getAll();
 *   await LocalDB.orders.insert({...});
 *   await LocalDB.sync.full();
 */
(function() {
    'use strict';

    const DB_NAME = 'centralux_local';
    const DB_VERSION = 1;
    const SYNC_INTERVAL_MS = 30000; // 30 seconds
    const ORDERS_STORE = 'orders';
    const METRICS_STORE = 'hub_metrics';

    let db = null;
    let _supabaseClient = null;
    let _syncTimer = null;
    let _isSyncing = false;
    let _lastSyncTime = null;

    // ============================
    // IndexedDB Core
    // ============================

    function openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Orders store — keyed by UUID 'id'
                if (!db.objectStoreNames.contains(ORDERS_STORE)) {
                    const ordersStore = db.createObjectStore(ORDERS_STORE, { keyPath: 'id' });
                    ordersStore.createIndex('order_id', 'order_id', { unique: false });
                    ordersStore.createIndex('status', 'status', { unique: false });
                    ordersStore.createIndex('archived', 'archived', { unique: false });
                    ordersStore.createIndex('_dirty', '_dirty', { unique: false });
                }

                // Hub metrics store — keyed by date string
                if (!db.objectStoreNames.contains(METRICS_STORE)) {
                    const metricsStore = db.createObjectStore(METRICS_STORE, { keyPath: 'date' });
                    metricsStore.createIndex('_dirty', '_dirty', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };

            request.onerror = (event) => {
                console.error('IndexedDB open error:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    function txStore(storeName, mode) {
        const tx = db.transaction(storeName, mode);
        return tx.objectStore(storeName);
    }

    function idbRequest(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    function idbGetAll(storeName) {
        return idbRequest(txStore(storeName, 'readonly').getAll());
    }

    function idbGet(storeName, key) {
        return idbRequest(txStore(storeName, 'readonly').get(key));
    }

    function idbPut(storeName, value) {
        return idbRequest(txStore(storeName, 'readwrite').put(value));
    }

    function idbDelete(storeName, key) {
        return idbRequest(txStore(storeName, 'readwrite').delete(key));
    }

    function idbClear(storeName) {
        return idbRequest(txStore(storeName, 'readwrite').clear());
    }

    // ============================
    // Orders CRUD
    // ============================

    const orders = {
        async getAll(filters = {}) {
            let all = await idbGetAll(ORDERS_STORE);
            
            // Filter out soft-deleted records
            all = all.filter(o => !o._deleted);
            
            if (filters.archived === false) {
                all = all.filter(o => !o.archived);
            }
            if (filters.cancelled === false) {
                all = all.filter(o => !o.cancelled);
            }
            if (filters.searchTerm) {
                const term = filters.searchTerm.toLowerCase();
                all = all.filter(o => 
                    (o.order_id && o.order_id.toLowerCase().includes(term)) ||
                    (o.client_name && o.client_name.toLowerCase().includes(term)) ||
                    (o.salesperson && o.salesperson.toLowerCase().includes(term))
                );
            }
            if (filters.limit) {
                all = all.slice(0, filters.limit);
            }
            return all;
        },

        async getById(id) {
            const record = await idbGet(ORDERS_STORE, id);
            if (record && !record._deleted) return record;
            return null;
        },

        async insert(order) {
            // Generate a local UUID if not provided
            if (!order.id) {
                order.id = crypto.randomUUID();
            }
            order._dirty = true;
            order._deleted = false;
            order._lastModified = new Date().toISOString();
            
            await idbPut(ORDERS_STORE, order);
            
            // Background sync to Supabase
            _pushSingleOrder(order);
            
            return order;
        },

        async update(id, data) {
            const existing = await idbGet(ORDERS_STORE, id);
            if (!existing) {
                console.warn('LocalDB: order not found for update:', id);
                return;
            }
            const updated = { ...existing, ...data, _dirty: true, _lastModified: new Date().toISOString() };
            await idbPut(ORDERS_STORE, updated);
            
            // Background sync
            _pushSingleOrder(updated);
        },

        async updateMany(ids, data) {
            for (const id of ids) {
                await orders.update(id, data);
            }
        },

        async delete(id) {
            // Hard delete: mark as _deleted locally, delete from Supabase
            const existing = await idbGet(ORDERS_STORE, id);
            if (existing) {
                existing._deleted = true;
                existing._dirty = true;
                existing._lastModified = new Date().toISOString();
                await idbPut(ORDERS_STORE, existing);
            }
            
            // Background sync — hard delete from Supabase
            _deleteSingleOrder(id);
        },

        async deleteMany(ids) {
            for (const id of ids) {
                await orders.delete(id);
            }
        },

        async archive(id) {
            await orders.update(id, { archived: true });
        },

        async archiveMany(ids) {
            for (const id of ids) {
                await orders.archive(id);
            }
        },

        async findByOrderId(orderId) {
            const all = await idbGetAll(ORDERS_STORE);
            return all.find(o => o.order_id === orderId && !o._deleted) || null;
        }
    };

    // ============================
    // Metrics CRUD  
    // ============================

    const metrics = {
        async get(date) {
            return await idbGet(METRICS_STORE, date);
        },

        async upsert(data) {
            const existing = await idbGet(METRICS_STORE, data.date) || {};
            const updated = { ...existing, ...data, _dirty: true };
            await idbPut(METRICS_STORE, updated);
            
            // Background sync
            _pushMetrics(updated);
        }
    };

    // ============================
    // Sync Engine
    // ============================

    async function _pushSingleOrder(order) {
        if (!_supabaseClient || !isOnline()) return;
        
        try {
            const cleanOrder = _stripMeta(order);
            
            if (order._deleted) {
                await _supabaseClient.from('orders').delete().eq('id', order.id);
                // Remove from local after confirmed delete
                await idbDelete(ORDERS_STORE, order.id);
            } else {
                const { error } = await _supabaseClient.from('orders').upsert([cleanOrder], { onConflict: 'id' });
                if (error) throw error;
                
                // Mark as clean
                order._dirty = false;
                await idbPut(ORDERS_STORE, order);
            }
            _updateSyncIndicator('synced');
        } catch (err) {
            console.warn('LocalDB: push single order failed (will retry):', err.message);
            _updateSyncIndicator('pending');
        }
    }

    async function _deleteSingleOrder(id) {
        if (!_supabaseClient || !isOnline()) return;
        
        try {
            await _supabaseClient.from('orders').delete().eq('id', id);
            // Remove from local store completely
            await idbDelete(ORDERS_STORE, id);
            _updateSyncIndicator('synced');
        } catch (err) {
            console.warn('LocalDB: delete sync failed (will retry):', err.message);
            _updateSyncIndicator('pending');
        }
    }

    async function _pushMetrics(data) {
        if (!_supabaseClient || !isOnline()) return;
        
        try {
            const clean = { date: data.date, entregas: data.entregas, retiradas: data.retiradas };
            await _supabaseClient.from('hub_metrics').upsert(clean);
            data._dirty = false;
            await idbPut(METRICS_STORE, data);
        } catch (err) {
            console.warn('LocalDB: push metrics failed:', err.message);
        }
    }

    function _stripMeta(record) {
        const clean = { ...record };
        delete clean._dirty;
        delete clean._deleted;
        delete clean._lastModified;
        return clean;
    }

    const sync = {
        async pull() {
            if (!_supabaseClient || !isOnline()) return false;
            if (_isSyncing) return false;
            
            _isSyncing = true;
            _updateSyncIndicator('syncing');
            
            try {
                // Pull orders
                const { data: remoteOrders, error: ordersError } = await _supabaseClient
                    .from('orders')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(500);
                
                if (ordersError) throw ordersError;
                
                if (remoteOrders) {
                    for (const remote of remoteOrders) {
                        const local = await idbGet(ORDERS_STORE, remote.id);
                        
                        // If local is dirty (has pending changes), skip overwrite
                        if (local && local._dirty) {
                            // Conflict: local has unsaved changes
                            // Compare timestamps — most recent wins
                            const localTime = new Date(local._lastModified || 0).getTime();
                            const remoteTime = new Date(remote.updated_at || remote.created_at || 0).getTime();
                            if (remoteTime > localTime) {
                                // Remote is newer, overwrite local
                                remote._dirty = false;
                                remote._deleted = false;
                                remote._lastModified = remote.updated_at || remote.created_at;
                                await idbPut(ORDERS_STORE, remote);
                            }
                            // else: local is newer, keep local version (will push on next cycle)
                        } else {
                            // No conflict, store remote version
                            remote._dirty = false;
                            remote._deleted = false;
                            remote._lastModified = remote.updated_at || remote.created_at;
                            await idbPut(ORDERS_STORE, remote);
                        }
                    }
                    
                    // Remove local records that no longer exist in Supabase
                    // (they were deleted from another device)
                    const remoteIds = new Set(remoteOrders.map(o => o.id));
                    const localOrders = await idbGetAll(ORDERS_STORE);
                    for (const local of localOrders) {
                        if (!remoteIds.has(local.id) && !local._dirty) {
                            await idbDelete(ORDERS_STORE, local.id);
                        }
                    }
                }
                
                // Pull metrics
                const { data: remoteMetrics } = await _supabaseClient
                    .from('hub_metrics')
                    .select('*');
                
                if (remoteMetrics) {
                    for (const metric of remoteMetrics) {
                        const local = await idbGet(METRICS_STORE, metric.date);
                        if (!local || !local._dirty) {
                            metric._dirty = false;
                            await idbPut(METRICS_STORE, metric);
                        }
                    }
                }
                
                _lastSyncTime = new Date();
                _updateSyncIndicator('synced');
                return true;
            } catch (err) {
                console.error('LocalDB sync pull error:', err);
                _updateSyncIndicator('error');
                return false;
            } finally {
                _isSyncing = false;
            }
        },

        async push() {
            if (!_supabaseClient || !isOnline()) return false;
            if (_isSyncing) return false;
            
            _isSyncing = true;
            _updateSyncIndicator('syncing');
            
            try {
                // Push dirty orders
                const allOrders = await idbGetAll(ORDERS_STORE);
                const dirtyOrders = allOrders.filter(o => o._dirty);
                
                for (const order of dirtyOrders) {
                    if (order._deleted) {
                        try {
                            await _supabaseClient.from('orders').delete().eq('id', order.id);
                            await idbDelete(ORDERS_STORE, order.id);
                        } catch (e) {
                            console.warn('Push delete failed for', order.id, e.message);
                        }
                    } else {
                        try {
                            const clean = _stripMeta(order);
                            const { error } = await _supabaseClient.from('orders').upsert([clean], { onConflict: 'id' });
                            if (!error) {
                                order._dirty = false;
                                await idbPut(ORDERS_STORE, order);
                            }
                        } catch (e) {
                            console.warn('Push upsert failed for', order.id, e.message);
                        }
                    }
                }
                
                // Push dirty metrics
                const allMetrics = await idbGetAll(METRICS_STORE);
                const dirtyMetrics = allMetrics.filter(m => m._dirty);
                
                for (const metric of dirtyMetrics) {
                    try {
                        const clean = { date: metric.date, entregas: metric.entregas, retiradas: metric.retiradas };
                        await _supabaseClient.from('hub_metrics').upsert(clean);
                        metric._dirty = false;
                        await idbPut(METRICS_STORE, metric);
                    } catch (e) {
                        console.warn('Push metric failed', e.message);
                    }
                }
                
                _lastSyncTime = new Date();
                _updateSyncIndicator('synced');
                return true;
            } catch (err) {
                console.error('LocalDB sync push error:', err);
                _updateSyncIndicator('error');
                return false;
            } finally {
                _isSyncing = false;
            }
        },

        async full() {
            const pulled = await sync.pull();
            if (pulled) {
                await sync.push();
            }
            return pulled;
        },

        isOnline: isOnline,
        
        getLastSyncTime() {
            return _lastSyncTime;
        },

        getDirtyCount: async function() {
            const allOrders = await idbGetAll(ORDERS_STORE);
            return allOrders.filter(o => o._dirty).length;
        }
    };

    // ============================
    // Online/Offline Detection
    // ============================

    function isOnline() {
        return navigator.onLine;
    }

    function _startAutoSync() {
        if (_syncTimer) clearInterval(_syncTimer);
        
        _syncTimer = setInterval(async () => {
            if (isOnline() && !_isSyncing && _supabaseClient) {
                const dirtyCount = await sync.getDirtyCount();
                if (dirtyCount > 0) {
                    console.log(`[LocalDB] Auto-sync: ${dirtyCount} dirty records`);
                    await sync.push();
                }
                // Periodic pull to get changes from other devices
                await sync.pull();
            }
        }, SYNC_INTERVAL_MS);

        // Listen for online/offline events
        window.addEventListener('online', () => {
            console.log('[LocalDB] Back online — syncing...');
            _updateSyncIndicator('syncing');
            sync.full();
        });

        window.addEventListener('offline', () => {
            console.log('[LocalDB] Went offline');
            _updateSyncIndicator('offline');
        });
    }

    // ============================
    // UI Sync Indicator
    // ============================

    function _updateSyncIndicator(status) {
        const el = document.getElementById('sync-status-indicator');
        if (!el) return;
        
        const iconEl = el.querySelector('.sync-icon');
        const textEl = el.querySelector('.sync-text');
        if (!iconEl || !textEl) return;

        // Remove all state classes
        el.classList.remove('sync-online', 'sync-offline', 'sync-syncing', 'sync-error', 'sync-pending');

        switch (status) {
            case 'synced':
                el.classList.add('sync-online');
                iconEl.textContent = 'cloud_done';
                iconEl.classList.remove('animate-spin');
                textEl.textContent = 'Sincronizado';
                break;
            case 'syncing':
                el.classList.add('sync-syncing');
                iconEl.textContent = 'sync';
                iconEl.classList.add('animate-spin');
                textEl.textContent = 'Sincronizando...';
                break;
            case 'offline':
                el.classList.add('sync-offline');
                iconEl.textContent = 'cloud_off';
                iconEl.classList.remove('animate-spin');
                textEl.textContent = 'Offline';
                break;
            case 'error':
                el.classList.add('sync-error');
                iconEl.textContent = 'cloud_off';
                iconEl.classList.remove('animate-spin');
                textEl.textContent = 'Erro de sync';
                break;
            case 'pending':
                el.classList.add('sync-pending');
                iconEl.textContent = 'cloud_upload';
                iconEl.classList.remove('animate-spin');
                textEl.textContent = 'Pendente';
                break;
        }
    }

    // ============================
    // Initialization
    // ============================

    async function init(supabaseClient) {
        _supabaseClient = supabaseClient;
        
        try {
            db = await openDB();
            console.log('[LocalDB] IndexedDB initialized');
        } catch (err) {
            console.error('[LocalDB] Failed to open IndexedDB:', err);
            return false;
        }

        // Initial sync: pull from Supabase to populate local DB
        if (_supabaseClient && isOnline()) {
            _updateSyncIndicator('syncing');
            await sync.full();
        } else {
            _updateSyncIndicator(isOnline() ? 'pending' : 'offline');
        }

        // Start auto-sync timer
        _startAutoSync();
        
        return true;
    }

    // ============================
    // Export global
    // ============================

    window.LocalDB = {
        init,
        orders,
        metrics,
        sync,
        isOnline
    };

})();
