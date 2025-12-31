/**
 * Safe Storage Tests
 * 
 * Unit tests for the hardened localStorage layer
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as safeStorage from '../src/lib/storage/safeStorage';

describe('SafeStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('getItem and setItem', () => {
    it('should store and retrieve data', () => {
      const testData = { name: 'test', value: 42 };
      safeStorage.setItem('test:key', testData);
      
      const retrieved = safeStorage.getItem<typeof testData>('test:key');
      expect(retrieved).toEqual(testData);
    });

    it('should return default value for missing keys', () => {
      const defaultValue = { missing: true };
      const result = safeStorage.getItem('test:missing', undefined, defaultValue);
      expect(result).toEqual(defaultValue);
    });

    it('should handle TTL expiration', (done) => {
      const testData = { temporary: true };
      safeStorage.setItem('test:ttl', testData, { ttl: 100 }); // 100ms TTL
      
      // Should exist immediately
      expect(safeStorage.getItem('test:ttl')).toEqual(testData);
      
      // Should be gone after TTL
      setTimeout(() => {
        expect(safeStorage.getItem('test:ttl')).toBeNull();
        done();
      }, 150);
    });

    it('should merge data when merge option is true', () => {
      safeStorage.setItem('test:merge', { a: 1, b: 2 });
      safeStorage.setItem('test:merge', { b: 3, c: 4 }, { merge: true });
      
      const result = safeStorage.getItem<any>('test:merge');
      expect(result).toEqual({ a: 1, b: 3, c: 4 });
    });
  });

  describe('integrity checks', () => {
    it('should detect corrupted data and restore defaults', () => {
      // Manually corrupt data
      localStorage.setItem('test:corrupt', '{"invalid json}');
      
      const result = safeStorage.getItem('test:corrupt', undefined, { fallback: true });
      expect(result).toEqual({ fallback: true });
    });

    it('should validate data with custom validator', () => {
      interface UserData {
        name: string;
        age: number;
      }
      
      const validator = (data: unknown): data is UserData => {
        return typeof data === 'object' && 
               data !== null && 
               'name' in data && 
               'age' in data &&
               typeof (data as any).name === 'string' &&
               typeof (data as any).age === 'number';
      };
      
      // Valid data
      safeStorage.setItem('test:user', { name: 'Alice', age: 30 });
      expect(safeStorage.getItem('test:user', validator)).toBeTruthy();
      
      // Invalid data
      safeStorage.setItem('test:invalid', { name: 'Bob' } as any);
      expect(safeStorage.getItem('test:invalid', validator, null)).toBeNull();
    });
  });

  describe('storage footprint', () => {
    it('should calculate storage footprint correctly', () => {
      safeStorage.setItem('learning:data1', { test: 'value1' });
      safeStorage.setItem('learning:data2', { test: 'value2' });
      safeStorage.setItem('coaching:data1', { test: 'value3' });
      
      const footprint = safeStorage.getStorageFootprint();
      
      expect(footprint.namespaces.learning).toBeGreaterThan(0);
      expect(footprint.namespaces.coaching).toBeGreaterThan(0);
      expect(footprint.totalBytes).toBeGreaterThan(0);
    });
  });

  describe('pruning', () => {
    it('should prune LRU entries when namespace exceeds quota', () => {
      // Fill namespace with data
      for (let i = 0; i < 10; i++) {
        safeStorage.setItem(`learning:item${i}`, { data: 'x'.repeat(1000) });
      }
      
      // Check initial count
      const initialFootprint = safeStorage.getStorageFootprint();
      const initialCount = Object.keys(localStorage)
        .filter(k => k.startsWith('learning:')).length;
      
      expect(initialCount).toBe(10);
      
      // Prune to target size
      safeStorage.pruneLRU('learning', 3000); // Keep ~3 entries
      
      const afterPruneCount = Object.keys(localStorage)
        .filter(k => k.startsWith('learning:')).length;
      
      expect(afterPruneCount).toBeLessThan(initialCount);
    });
  });

  describe('migration', () => {
    it('should migrate data between versions', () => {
      interface V1Data {
        oldField: string;
      }
      
      interface V2Data {
        newField: string;
      }
      
      // Store V1 data
      safeStorage.setItem<V1Data>('test:migrate', { oldField: 'value' }, { version: 1 });
      
      // Migrate to V2
      const migrated = safeStorage.migrate<V1Data, V2Data>(
        'test:migrate',
        1,
        2,
        (old) => ({ newField: old.oldField.toUpperCase() })
      );
      
      expect(migrated).toBe(true);
      
      const result = safeStorage.getItem<V2Data>('test:migrate');
      expect(result).toEqual({ newField: 'VALUE' });
    });
  });

  describe('namespace management', () => {
    it('should clear all entries in a namespace', () => {
      safeStorage.setItem('learning:item1', { data: 1 });
      safeStorage.setItem('learning:item2', { data: 2 });
      safeStorage.setItem('coaching:item1', { data: 3 });
      
      safeStorage.clearNamespace('learning');
      
      expect(safeStorage.getItem('learning:item1')).toBeNull();
      expect(safeStorage.getItem('learning:item2')).toBeNull();
      expect(safeStorage.getItem('coaching:item1')).toBeTruthy();
    });
  });

  describe('storage availability', () => {
    it('should detect if storage is available', () => {
      expect(safeStorage.isStorageAvailable()).toBe(true);
    });
  });
});
