import * as React from "react";
import { Text, View, StyleSheet, Button } from "react-native";
import Constants from "expo-constants";
import * as Permissions from "expo-permissions";

import { BarCodeScanner } from "expo-barcode-scanner";

export default class BarcodeScanner extends React.Component {
  state = {
    hasCameraPermission: null,
    scanned: false,
  };

  async componentDidMount() {
    this.getPermissionsAsync();
  }

  getPermissionsAsync = async () => {
    const { status } = await Permissions.askAsync(Permissions.CAMERA);
    this.setState({ hasCameraPermission: status === "granted" });
  };

  handleSessionId = (text) => {
    this.setState({ sessionId: text });
  };
  handleUrl = (text) => {
    console.log(text);
  };

  render() {
    const { hasCameraPermission, scanned } = this.state;

    if (hasCameraPermission === null) {
      return <Text>Requesting for camera permission</Text>;
    }
    if (hasCameraPermission === false) {
      return <Text>No access to camera</Text>;
    }
    return (
      // <View style={styles.mainContainer}>
      /* <View>
        <TextInput style = {styles.urlInput}
               underlineColorAndroid = "transparent"
               placeholder = "Enter Session Id"
               placeholderTextColor = "#9a73ef"
               autoCapitalize = "none"
               onChangeText = {this.handleSessionId}/>
            
            <TouchableOpacity
               style = {styles.submitButton}
               onPress = {submitSessionId}>
               <Text style = {styles.submitButtonText}> Submit </Text>
            </TouchableOpacity>
        </View> */
      <View
        style={{
          flex: 1,
          flexDirection: "column",
          justifyContent: "flex-end",
        }}
      >
        <BarCodeScanner
          onBarCodeScanned={scanned ? undefined : this.handleBarCodeScanned}
          style={StyleSheet.absoluteFillObject}
        />

        {scanned && (
          <Button
            title={"Tap to Scan Again"}
            onPress={() => this.setState({ scanned: false })}
          />
        )}
      </View>
      // </View>
    );
  }

  handleBarCodeScanned = ({ type, data }) => {
    // passing data from here
    this.setState({ scanned: true });
    this.props.navigation.navigate("Channel");
    // alert(`Bar code with type ${type} and data ${data} has been scanned!`);
  };
}
