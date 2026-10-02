import React, { Component, ErrorInfo, ReactNode } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from "react-native";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react-native";
import { router } from "expo-router";

interface Props {
  children: ReactNode;
  screenName?: string;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ErrorBoundary] Uncaught error in ${this.props.screenName || "Screen"}:`, error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleGoBack = () => {
    this.setState({ hasError: false, error: null });
    try {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/");
      }
    } catch {
      router.replace("/");
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <AlertTriangle size={32} color="#f43f5e" />
            </View>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.subtitle}>
              An unexpected error occurred while loading {this.props.screenName || "this screen"}.
            </Text>

            {this.state.error?.message ? (
              <ScrollView style={styles.errorBox} contentContainerStyle={{ padding: 8 }}>
                <Text style={styles.errorText} numberOfLines={4}>
                  {this.state.error.message}
                </Text>
              </ScrollView>
            ) : null}

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={this.handleGoBack} activeOpacity={0.8}>
                <ArrowLeft size={16} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.btnText}>Go Back</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.primaryBtn} onPress={this.handleReset} activeOpacity={0.8}>
                <RefreshCw size={16} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.btnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d0e11",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#16171b",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(244, 63, 94, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f3f4f6",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#9ca3af",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 20,
  },
  errorBox: {
    width: "100%",
    maxHeight: 90,
    backgroundColor: "#0a0b0d",
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.2)",
  },
  errorText: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    fontSize: 11,
    color: "#f87171",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    borderRadius: 12,
    backgroundColor: "#22242a",
  },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    borderRadius: 12,
    backgroundColor: "#3b82f6",
  },
  btnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
});

export default ErrorBoundary;
