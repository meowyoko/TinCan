type TinCanConfig = {
  enabled: boolean;
  hubUrl: string;
  pin: string;
};

const defaultTinCanConfig: TinCanConfig = {
  enabled: false,
  hubUrl: 'ws://64.188.26.146:3100',
  pin: '',
};

let localTinCanConfig: Partial<TinCanConfig> = {};

try {
  localTinCanConfig =
    (require('./tincanConfig.local') as {
      tinCanLocalConfig?: Partial<TinCanConfig>;
    }).tinCanLocalConfig ?? {};
} catch {
  localTinCanConfig = {};
}

export const tinCanConfig: TinCanConfig = {
  ...defaultTinCanConfig,
  ...localTinCanConfig,
};
