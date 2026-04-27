"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageType = exports.MessageDirection = exports.CommunicationChannel = void 0;
var CommunicationChannel;
(function (CommunicationChannel) {
    CommunicationChannel["WHATSAPP"] = "WHATSAPP";
    CommunicationChannel["EMAIL"] = "EMAIL";
    CommunicationChannel["VOIP"] = "VOIP";
    CommunicationChannel["SMS"] = "SMS";
})(CommunicationChannel || (exports.CommunicationChannel = CommunicationChannel = {}));
var MessageDirection;
(function (MessageDirection) {
    MessageDirection["INBOUND"] = "INBOUND";
    MessageDirection["OUTBOUND"] = "OUTBOUND";
})(MessageDirection || (exports.MessageDirection = MessageDirection = {}));
var MessageType;
(function (MessageType) {
    MessageType["TEXT"] = "TEXT";
    MessageType["IMAGE"] = "IMAGE";
    MessageType["DOCUMENT"] = "DOCUMENT";
    MessageType["AUDIO"] = "AUDIO";
    MessageType["VIDEO"] = "VIDEO";
    MessageType["TEMPLATE"] = "TEMPLATE";
})(MessageType || (exports.MessageType = MessageType = {}));
//# sourceMappingURL=communication.types.js.map