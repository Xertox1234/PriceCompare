/**
 * Mock Chrome Extension APIs for testing
 * Provides Jest-compatible mocks for all Chrome APIs used in the extension
 */

const chromeMock = {
  // Storage API
  storage: {
    sync: {
      get: jest.fn((keys, callback) => {
        const result = {};
        if (callback) {
          callback(result);
        }
        return Promise.resolve(result);
      }),
      set: jest.fn((items, callback) => {
        if (callback) {
          callback();
        }
        return Promise.resolve();
      }),
      remove: jest.fn((keys, callback) => {
        if (callback) {
          callback();
        }
        return Promise.resolve();
      }),
      clear: jest.fn((callback) => {
        if (callback) {
          callback();
        }
        return Promise.resolve();
      })
    },
    local: {
      get: jest.fn((keys, callback) => {
        const result = {};
        if (callback) {
          callback(result);
        }
        return Promise.resolve(result);
      }),
      set: jest.fn((items, callback) => {
        if (callback) {
          callback();
        }
        return Promise.resolve();
      }),
      remove: jest.fn((keys, callback) => {
        if (callback) {
          callback();
        }
        return Promise.resolve();
      }),
      clear: jest.fn((callback) => {
        if (callback) {
          callback();
        }
        return Promise.resolve();
      })
    }
  },

  // Runtime API
  runtime: {
    onInstalled: {
      addListener: jest.fn()
    },
    onMessage: {
      addListener: jest.fn()
    },
    sendMessage: jest.fn((message, callback) => {
      if (callback) {
        callback({ success: true });
      }
      return Promise.resolve({ success: true });
    }),
    getManifest: jest.fn(() => ({
      version: '1.0.0',
      name: 'PriceCompare History'
    })),
    setUninstallURL: jest.fn(),
    id: 'test-extension-id'
  },

  // Tabs API
  tabs: {
    query: jest.fn((queryInfo, callback) => {
      const tabs = [];
      if (callback) {
        callback(tabs);
      }
      return Promise.resolve(tabs);
    }),
    create: jest.fn((createProperties, callback) => {
      const tab = { id: 1, url: createProperties.url };
      if (callback) {
        callback(tab);
      }
      return Promise.resolve(tab);
    }),
    onUpdated: {
      addListener: jest.fn()
    }
  },

  // Notifications API
  notifications: {
    create: jest.fn((notificationId, options, callback) => {
      const id = notificationId || 'notification-id';
      if (callback) {
        callback(id);
      }
      return Promise.resolve(id);
    }),
    clear: jest.fn((notificationId, callback) => {
      if (callback) {
        callback(true);
      }
      return Promise.resolve(true);
    })
  },

  // Context Menus API
  contextMenus: {
    create: jest.fn((createProperties, callback) => {
      if (callback) {
        callback();
      }
    }),
    remove: jest.fn((menuItemId, callback) => {
      if (callback) {
        callback();
      }
      return Promise.resolve();
    }),
    onClicked: {
      addListener: jest.fn()
    }
  },

  // Action API (Manifest V3)
  action: {
    onClicked: {
      addListener: jest.fn()
    },
    setIcon: jest.fn(),
    setBadgeText: jest.fn(),
    setBadgeBackgroundColor: jest.fn()
  },

  // Alarms API
  alarms: {
    create: jest.fn((name, alarmInfo) => {}),
    clear: jest.fn((name, callback) => {
      if (callback) {
        callback(true);
      }
      return Promise.resolve(true);
    }),
    onAlarm: {
      addListener: jest.fn()
    }
  },

  // Web Request API
  webRequest: {
    onBeforeRequest: {
      addListener: jest.fn()
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
  if (!chromeMock.__storageData) {
    chromeMock.__storageData = { sync: {}, local: {} };
  }
  Object.assign(chromeMock.__storageData.sync, items);
  return Promise.resolve();
});

chromeMock.storage.local.set.mockImplementation((items) => {
  if (!chromeMock.__storageData) {
    chromeMock.__storageData = { sync: {}, local: {} };
  }
  Object.assign(chromeMock.__storageData.local, items);
  return Promise.resolve();
});

// Helper to reset storage
chromeMock.__resetStorage = () => {
  chromeMock.__storageData = { sync: {}, local: {} };
};

module.exports = chromeMock;
