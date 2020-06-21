import React, { Component } from "react";
import { YellowBox } from "react-native";
import { createAppContainer } from "react-navigation";
import { createStackNavigator } from "react-navigation-stack";
import ChannelScreen from "./screens/ChannelScreen";
import BarcodeScanner from "./screens/BarcodeScanner";
YellowBox.ignoreWarnings(["Setting a timer"]);

const RootStack = createStackNavigator({
  Scan: BarcodeScanner,
  Channel: ChannelScreen,
});

const AppContainer = createAppContainer(RootStack);

class Router extends Component {
  render() {
    return <AppContainer />;
  }
}

export default Router;
