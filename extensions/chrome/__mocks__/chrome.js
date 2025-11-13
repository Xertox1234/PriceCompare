/**
 * Mock Chrome Extension APIs for testing
 * Provides Vitest-compatible mocks for all Chrome APIs used in the extension
 */

import { vi } from 'vitest';

const chromeMock = {
  __storageData: { sync: {}, local: {} },

  // Storage API
  storage: {
    sync: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn()
    },
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn()
    }
  },

  // Runtime API
  runtime: {
    onInstalled: {
      addListener: vi.fn()
    },
    onMessage: {
      addListener: vi.fn()
    },
    sendMessage: vi.fn((message, callback) => {
      if (callback) {
        callback({ success: true });
      }
      return Promise.resolve({ success: true });
    }),
    getManifest: vi.fn(() => ({
      version: '1.0.0',
      name: 'PriceCompare History'
    })),
    setUninstallURL: vi.fn(),
    id: 'test-extension-id'
  },

  // Tabs API
  tabs: {
    query: vi.fn((queryInfo, callback) => {
      const tabs = [];
      if (callback) {
        callback(tabs);
      }
      return Promise.resolve(tabs);
    }),
    create: vi.fn((createProperties, callback) => {
      const tab = { id: 1, url: createProperties.url };
      if (callback) {
        callback(tab);
      }
      return Promise.resolve(tab);
    }),
    onUpdated: {
      addListener: vi.fn()
    }
  },

  // Notifications API
  notifications: {
    create: vi.fn((notificationId, options, callback) => {
      const id = notificationId || 'notification-id';
      if (callback) {
        callback(id);
      }
      return Promise.resolve(id);
    }),
    clear: vi.fn((notificationId, callback) => {
      if (callback) {
        callback(true);
      }
      return Promise.resolve(true);
    })
  },

  // Context Menus API
  contextMenus: {
    create: vi.fn((createProperties, callback) => {
      if (callback) {
        callback();
      }
    }),
    remove: vi.fn((menuItemId, callback) => {
      if (callback) {
        callback();
      }
      return Promise.resolve();
    }),
    onClicked: {
      addListener: vi.fn()
    }
  },

  // Action API (Manifest V3)
  action: {
    onClicked: {
      addListener: vi.fn()
    },
    setIcon: vi.fn(),
    setBadgeText: vi.fn(),
    setBadgeBackgroundColor: vi.fn()
  },

  // Alarms API
  alarms: {
    create: vi.fn((name, alarmInfo) => {}),
    clear: vi.fn((name, callback) => {
      if (callback) {
        callback(true);
      }
      return Promise.resolve(true);
    }),
    onAlarm: {
      addListener: vi.fn()
    }
  },

  // Web Request API
  webRequest: {
    onBeforeRequest: {
      addListener: vi.fn()
    }
  }
};

// Helper function to set mock storage data
chromeMock.storage.sync.get.mockImplementation((keys) => {
  const data = chromeMock.__storageData?.sync || {};
  if (Array.isArray(keys)) {
    const result = {};
    keys.forEach(key => {
      if (data[key] !== undefined) {
        result[key] = data[key];
      }
    });
    return Promise.resolve(result);
  } else if (typeof keys === 'string') {
    return Promise.resolve({ [keys]: data[keys] });
  } else if (keys === null || keys === undefined) {
    return Promise.resolve(data);
  } else if (typeof keys === 'object') {
    const result = { ...keys };
    Object.keys(keys).forEach(key => {
      if (data[key] !== undefined) {
        result[key] = data[key];
      }
    });
    return Promise.resolve(result);
  }
  return Promise.resolve({});
});

chromeMock.storage.local.get.mockImplementation((keys) => {
  const data = chromeMock.__storageData?.local || {};
  if (Array.isArray(keys)) {
    const result = {};
    keys.forEach(key => {
      if (data[key] !== undefined) {
        result[key] = data[key];
      }
    });
    return Promise.resolve(result);
  } else if (typeof keys === 'string') {
    return Promise.resolve({ [keys]: data[keys] });
  } else if (keys === null || keys === undefined) {
    return Promise.resolve(data);
  } else if (typeof keys === 'object') {
    const result = { ...keys };
    Object.keys(keys).forEach(key => {
      if (data[key] !== undefined) {
        result[key] = data[key];
      }
    });
    return Promise.resolve(result);
  }
  return Promise.resolve({});
});

chromeMock.storage.sync.set.mockImplementation((items) => {
  Object.assign(chromeMock.__storageData.sync, items);
  return Promise.resolve();
});

chromeMock.storage.local.set.mockImplementation((items) => {
  Object.assign(chromeMock.__storageData.local, items);
  return Promise.resolve();
});

chromeMock.storage.sync.remove.mockImplementation((keys) => {
  if (Array.isArray(keys)) {
    keys.forEach(key => delete chromeMock.__storageData.sync[key]);
  } else {
    delete chromeMock.__storageData.sync[keys];
  }
  return Promise.resolve();
});

chromeMock.storage.local.remove.mockImplementation((keys) => {
  if (Array.isArray(keys)) {
    keys.forEach(key => delete chromeMock.__storageData.local[key]);
  } else {
    delete chromeMock.__storageData.local[keys];
  }
  return Promise.resolve();
});

chromeMock.storage.sync.clear.mockImplementation(() => {
  chromeMock.__storageData.sync = {};
  return Promise.resolve();
});

chromeMock.storage.local.clear.mockImplementation(() => {
  chromeMock.__storageData.local = {};
  return Promise.resolve();
});

// Helper to reset storage
chromeMock.__resetStorage = () => {
  chromeMock.__storageData = { sync: {}, local: {} };
};

export default chromeMock;
