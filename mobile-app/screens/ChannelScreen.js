import React from "react";
import { View, SafeAreaView } from "react-native";
import { StreamChat } from "stream-chat";
import { Chat, Channel, MessageList, MessageInput } from "stream-chat-expo";

const chatClient = new StreamChat("f8wwud5et5jd");
const userToken =
  "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoibGF0ZS13aWxkZmxvd2VyLTkifQ.OzKfpg-vjGKkKf07tQXmpld989OjcivcNYERdTVGd80";

const user = {
  id: "late-wildflower-9",
  name: "Late wildflower",
  image:
    "https://stepupandlive.files.wordpress.com/2014/09/3d-animated-frog-image.jpg",
};

chatClient.setUser(user, userToken);

class ChannelScreen extends React.Component {
  render() {
    const channel = chatClient.channel("messaging", "late-wildflower-9");
    channel.watch();

    return (
      <SafeAreaView>
        <Chat client={chatClient}>
          <Channel channel={channel}>
            <View style={{ display: "flex", height: "100%" }}>
              <MessageList />
              <MessageInput />
            </View>
          </Channel>
        </Chat>
      </SafeAreaView>
    );
  }
}

export default ChannelScreen;
