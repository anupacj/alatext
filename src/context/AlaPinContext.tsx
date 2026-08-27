import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface AlaPinContextType {
  isLocked: boolean;
  isDecoyMode: boolean;
  isPinEnabled: boolean;
  realPin: string | null;
  decoyPin: string | null;
  unlockWithPin: (enteredPin: string) => { success: boolean; isDecoy: boolean };
  setupRealPin: (pin: string) => Promise<void>;
  setupDecoyPin: (pin: string | null) => Promise<void>;
  togglePinEnabled: (enabled: boolean) => Promise<void>;
  lockNow: () => void;
}

const AlaPinContext = createContext<AlaPinContextType | undefined>(undefined);

export const AlaPinProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPinEnabled, setIsPinEnabled] = useState(false);
  const [realPin, setRealPinState] = useState<string | null>(null);
  const [decoyPin, setDecoyPinState] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isDecoyMode, setIsDecoyMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPinSettings();
  }, []);

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
    }
  };

  const lockNow = () => {
    if (isPinEnabled && realPin) {
      setIsLocked(true);
      setIsDecoyMode(false);
    }
  };

  return (
    <AlaPinContext.Provider
      value={{
        isLocked,
        isDecoyMode,
        isPinEnabled,
        realPin,
        decoyPin,
        unlockWithPin,
        setupRealPin,
        setupDecoyPin,
        togglePinEnabled,
        lockNow,
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
      unlockWithPin: () => ({ success: false, isDecoy: false }),
      setupRealPin: async () => {},
      setupDecoyPin: async () => {},
      togglePinEnabled: async () => {},
      lockNow: () => {},
    };
  }
  return context;
};
