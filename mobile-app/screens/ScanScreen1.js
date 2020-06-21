import React, { useState, useEffect } from "react";
import { Text, View, StyleSheet, Button } from "react-native";
import { BarCodeScanner } from "expo-barcode-scanner";

export default class ScanScreen extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasPermission: false,
      scanned: "",
    };
  }
  async componentDidMount() {
    const { status } = await BarCodeScanner.requestPermissionsAsync();
    if (status == "granted") {
      this.setState({ ...this.state, hasPermission: true });
    }
  }

  handleBarCodeScanned = ({ type, data }) => {
    if (data) {
      this.setState({ ...this.state, scanned: true });
      props.navigation.navigate("Channel");
    }
    // alert(`Bar code with type ${type} and data ${data} has been scanned!`);
  };

  render() {
    if (this.state.hasPermission === null) {
      return <Text>Requesting for camera permission</Text>;
    }
    if (this.state.hasPermission === false) {
      return <Text>No access to camera</Text>;
    }
    return (
      <View
        style={{
          flex: 1,
          flexDirection: "column",
          justifyContent: "flex-end",
        }}
      >
        <BarCodeScanner
          onBarCodeScanned={
            this.state.scanned ? undefined : handleBarCodeScanned
          }
          style={StyleSheet.absoluteFillObject}
        />

        {this.state.scanned && (
          <Button
            title={"Tap to Scan Again"}
            onPress={() => {
              this.setState({ ...this.state, scanned: false });
            }}
          />
        )}
      </View>
    );
  }
}

const Scan = (props) => {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(true);
    })();
  }, [hasPermission]);

  const handleBarCodeScanned = ({ type, data }) => {
    setScanned(true);
    if (scanned) {
      props.navigation.navigate("Channel");
    }
    // alert(`Bar code with type ${type} and data ${data} has been scanned!`);
  };

  if (hasPermission === null) {
    return <Text>Requesting for camera permission</Text>;
  }
  if (hasPermission === false) {
    return <Text>No access to camera</Text>;
  }

  return (
    <View
      style={{
        flex: 1,
        flexDirection: "column",
        justifyContent: "flex-end",
      }}
    >
      <BarCodeScanner
        onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
        style={StyleSheet.absoluteFillObject}
      />

      {scanned && (
        <Button title={"Tap to Scan Again"} onPress={() => setScanned(false)} />
      )}
    </View>
  );
};

// export default ScanScreen;
