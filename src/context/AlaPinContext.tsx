import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";

interface AlaPinContextType {
  isLocked: boolean;
  isDecoyMode: boolean;
  isPinEnabled: boolean;
  realPin: string | null;
  decoyPin: string | null;
  isBiometricSupported: boolean;
  isBiometricEnrolled: boolean;
  isBiometricEnabled: boolean;
  vaultUnlocked: boolean;
  setVaultUnlocked: React.Dispatch<React.SetStateAction<boolean>>;
  unlockWithPin: (enteredPin: string) => { success: boolean; isDecoy: boolean };
  authenticateBiometrics: (reason?: string) => Promise<{ success: boolean; error?: string }>;
  unlockVaultWithPin: (enteredPin: string) => { success: boolean; isDecoy: boolean };
  unlockVaultWithBiometrics: () => Promise<boolean>;
  setupRealPin: (pin: string) => Promise<void>;
  setupDecoyPin: (pin: string | null) => Promise<void>;
  togglePinEnabled: (enabled: boolean) => Promise<void>;
  toggleBiometricEnabled: (enabled: boolean) => Promise<void>;
  lockNow: () => void;
  lockVault: () => void;
}

const AlaPinContext = createContext<AlaPinContextType | undefined>(undefined);

export const AlaPinProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPinEnabled, setIsPinEnabled] = useState(false);
  const [realPin, setRealPinState] = useState<string | null>(null);
  const [decoyPin, setDecoyPinState] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isDecoyMode, setIsDecoyMode] = useState(false);
  const [loading, setLoading] = useState(true);

  // Biometrics State
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [isBiometricEnrolled, setIsBiometricEnrolled] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);

  // Vault State
  const [vaultUnlocked, setVaultUnlocked] = useState(false);

  useEffect(() => {
    loadPinSettings();
    checkBiometrics();
  }, []);

  const checkBiometrics = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      setIsBiometricSupported(hasHardware);
      if (hasHardware) {
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setIsBiometricEnrolled(enrolled);
      }
      const bioEnabled = await AsyncStorage.getItem("@alapin_biometric_enabled");
      setIsBiometricEnabled(bioEnabled === "true");
    } catch (e) {
      console.warn("Failed to check biometrics:", e);
    }
  };

  const loadPinSettings = async () => {
    try {
      const enabled = await AsyncStorage.getItem("@alapin_enabled");
      const rPin = await AsyncStorage.getItem("@alapin_real_pin");
      const dPin = await AsyncStorage.getItem("@alapin_decoy_pin");

      const pinActive = enabled === "true" && !!rPin;
      setIsPinEnabled(pinActive);
      setRealPinState(rPin);
      setDecoyPinState(dPin);
      if (pinActive) {
        setIsLocked(true);
      }
    } catch (e) {
      console.error("Failed to load AlaPin settings:", e);
    } finally {
      setLoading(false);
    }
  };

  const authenticateBiometrics = async (reason = "Unlock AlaText & Vault") => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        return { success: false, error: "Biometric hardware not supported on this device." };
      }
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!enrolled) {
        return { success: false, error: "No fingerprints or biometrics enrolled." };
      }

      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        fallbackLabel: "Enter PIN",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });

      if (res.success) {
        setIsLocked(false);
        setIsDecoyMode(false);
        return { success: true };
      }
      return { success: false, error: res.error || "Authentication cancelled" };
    } catch (err: any) {
      return { success: false, error: err?.message || "Biometric authentication failed" };
    }
  };

  const unlockWithPin = (enteredPin: string) => {
    if (realPin && enteredPin === realPin) {
      setIsDecoyMode(false);
      setIsLocked(false);
      return { success: true, isDecoy: false };
    }
    if (decoyPin && enteredPin === decoyPin) {
      setIsDecoyMode(true);
      setIsLocked(false);
      return { success: true, isDecoy: true };
    }
    return { success: false, isDecoy: false };
  };

  const unlockVaultWithPin = (enteredPin: string) => {
    if (realPin && enteredPin === realPin) {
      setVaultUnlocked(true);
      return { success: true, isDecoy: false };
    }
    if (decoyPin && enteredPin === decoyPin) {
      setVaultUnlocked(false);
      return { success: true, isDecoy: true };
    }
    return { success: false, isDecoy: false };
  };

  const unlockVaultWithBiometrics = async () => {
    const res = await authenticateBiometrics("Unlock Secret Vault & Memories");
    if (res.success) {
      setVaultUnlocked(true);
      return true;
    }
    return false;
  };

  const setupRealPin = async (pin: string) => {
    setRealPinState(pin);
    setIsPinEnabled(true);
    await AsyncStorage.setItem("@alapin_real_pin", pin);
    await AsyncStorage.setItem("@alapin_enabled", "true");
  };

  const setupDecoyPin = async (pin: string | null) => {
    setDecoyPinState(pin);
    if (pin) {
      await AsyncStorage.setItem("@alapin_decoy_pin", pin);
    } else {
      await AsyncStorage.removeItem("@alapin_decoy_pin");
    }
  };

  const togglePinEnabled = async (enabled: boolean) => {
    setIsPinEnabled(enabled);
    await AsyncStorage.setItem("@alapin_enabled", enabled ? "true" : "false");
    if (!enabled) {
      setIsLocked(false);
      setIsDecoyMode(false);
      setVaultUnlocked(false);
    }
  };

  const toggleBiometricEnabled = async (enabled: boolean) => {
    setIsBiometricEnabled(enabled);
    await AsyncStorage.setItem("@alapin_biometric_enabled", enabled ? "true" : "false");
  };

  const lockNow = () => {
    setVaultUnlocked(false);
    if (isPinEnabled && realPin) {
      setIsLocked(true);
      setIsDecoyMode(false);
    }
  };

  const lockVault = () => {
    setVaultUnlocked(false);
  };

  return (
    <AlaPinContext.Provider
      value={{
        isLocked,
        isDecoyMode,
        isPinEnabled,
        realPin,
        decoyPin,
        isBiometricSupported,
        isBiometricEnrolled,
        isBiometricEnabled,
        vaultUnlocked,
        setVaultUnlocked,
        unlockWithPin,
        authenticateBiometrics,
        unlockVaultWithPin,
        unlockVaultWithBiometrics,
        setupRealPin,
        setupDecoyPin,
        togglePinEnabled,
        toggleBiometricEnabled,
        lockNow,
        lockVault,
      }}
    >
      {children}
    </AlaPinContext.Provider>
  );
};

export const useAlaPin = () => {
  const context = useContext(AlaPinContext);
  if (!context) {
    return {
      isLocked: false,
      isDecoyMode: false,
      isPinEnabled: false,
      realPin: null,
      decoyPin: null,
      isBiometricSupported: false,
      isBiometricEnrolled: false,
      isBiometricEnabled: false,
      vaultUnlocked: false,
      setVaultUnlocked: () => {},
      unlockWithPin: () => ({ success: false, isDecoy: false }),
      authenticateBiometrics: async () => ({ success: false, error: "No provider" }),
      unlockVaultWithPin: () => ({ success: false, isDecoy: false }),
      unlockVaultWithBiometrics: async () => false,
      setupRealPin: async () => {},
      setupDecoyPin: async () => {},
      togglePinEnabled: async () => {},
      toggleBiometricEnabled: async () => {},
      lockNow: () => {},
      lockVault: () => {},
    };
  }
  return context;
};

