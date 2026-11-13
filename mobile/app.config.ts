const apiBaseUrl = process.env.THERMATRUST_API_BASE_URL ?? process.env.EXPO_PUBLIC_API_BASE_URL;
const publicWebBaseUrl = process.env.EXPO_PUBLIC_WEB_BASE_URL ?? process.env.FRONTEND_URL;
const isReleaseBuild = Boolean(process.env.EAS_BUILD_PROFILE && process.env.EAS_BUILD_PROFILE !== 'development');

if (isReleaseBuild) {
  if (!apiBaseUrl) {
    throw new Error('Release builds require EXPO_PUBLIC_API_BASE_URL to be set in the EAS build environment.');
  }
  const apiUrl = new URL(apiBaseUrl);
  if (apiUrl.protocol !== 'https:' || apiUrl.hostname === 'localhost' || apiUrl.hostname === '127.0.0.1') {
    throw new Error('Release builds require a reachable HTTPS API URL; localhost and HTTP are not allowed.');
  }
  if (publicWebBaseUrl) {
    const webUrl = new URL(publicWebBaseUrl);
    if (webUrl.protocol !== 'https:' || webUrl.hostname === 'localhost' || webUrl.hostname === '127.0.0.1') {
      throw new Error('Release builds require a reachable HTTPS public web URL.');
    }
  }
}

export default {
  expo: {
    name: 'ThermaTrust',
    slug: 'thermatrust',
    scheme: 'thermatrust',
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'automatic',
    updates: {
      fallbackToCacheTimeout: 0,
    },
    assetBundlePatterns: ['**/*'],
    icon: './assets/icon.png',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#0B2F5B',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.thermatrust.mobile',
      icon: './assets/icon.png',
      infoPlist: {
        NSCameraUsageDescription: 'Take photos for service reports and credentials',
        NSPhotoLibraryUsageDescription: 'Select photos for service reports and credentials',
      },
    },
    android: {
      package: 'com.thermatrust.mobile',
      softwareKeyboardLayoutMode: 'resize',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      permissions: ['CAMERA'],
    },
    plugins: [
      'expo-secure-store',
      ['expo-image-picker', {
        cameraPermission: 'Allow ThermaTrust to take service evidence and credential photos.',
        photosPermission: 'Allow ThermaTrust to select service evidence and credential photos.',
      }],
      'expo-document-picker',
      ['expo-build-properties', {
        ios: { useFrameworks: 'static' },
        android: {
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
          buildArchs: ['arm64-v8a'],
        },
      }],
    ],
    extra: {
      apiBaseUrl,
      publicWebBaseUrl,
    },
  },
};