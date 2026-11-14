
import React from 'react';
import {
  View,
  Text,
  Animated,
  Easing,
} from 'react-native';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
} from 'lucide-react-native';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

const TOAST_CONFIG = {
  success: {
    color: '#059669',
    bg: '#ECFDF5',
    Icon: CheckCircle2,
  },
  error: {
    color: '#DC2626',
    bg: '#FEF2F2',
    Icon: XCircle,
  },
  warning: {
    color: '#D97706',
    bg: '#FFFBEB',
    Icon: AlertTriangle,
  },
  info: {
    color: '#0D9488',
    bg: '#EAF5F3',
    Icon: Info,
  },
};

export const ToastItem = ({
  message,
  type,
}: ToastProps) => {
  const fadeAnim = React.useRef(
    new Animated.Value(0)
  ).current;

  const slideAnim = React.useRef(
    new Animated.Value(-18)
  ).current;

  const config = TOAST_CONFIG[type];
  const Icon = config.Icon;

  React.useEffect(() => {
    const showAnimation = Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        speed: 18,
        bounciness: 3,
        useNativeDriver: true,
      }),
    ]);

    showAnimation.start();

    return () => {
      showAnimation.stop();
    };
  }, [fadeAnim, slideAnim]);

  return (
    <Animated.View
      accessibilityRole="alert"
      style={{
        width: '100%',
        maxWidth: 460,
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E8EDF3',
        padding: 14,
        marginBottom: 10,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.09,
        shadowRadius: 14,
        elevation: 5,
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: config.bg,
          marginRight: 12,
        }}
      >
        <Icon
          size={21}
          color={config.color}
          strokeWidth={2.2}
        />
      </View>

      <Text
        style={{
          flex: 1,
          fontSize: 13,
          lineHeight: 19,
          fontWeight: '600',
          color: '#334155',
        }}
      >
        {message}
      </Text>

      <View
        style={{
          width: 4,
          alignSelf: 'stretch',
          borderRadius: 5,
          backgroundColor: config.color,
          marginLeft: 10,
        }}
      />
    </Animated.View>
  );
};
