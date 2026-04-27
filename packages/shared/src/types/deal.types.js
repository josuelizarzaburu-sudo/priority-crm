"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityType = exports.DealStatus = void 0;
var DealStatus;
(function (DealStatus) {
    DealStatus["OPEN"] = "OPEN";
    DealStatus["WON"] = "WON";
    DealStatus["LOST"] = "LOST";
})(DealStatus || (exports.DealStatus = DealStatus = {}));
var ActivityType;
(function (ActivityType) {
    ActivityType["NOTE"] = "NOTE";
    ActivityType["CALL"] = "CALL";
    ActivityType["EMAIL"] = "EMAIL";
    ActivityType["MEETING"] = "MEETING";
    ActivityType["TASK"] = "TASK";
    ActivityType["STAGE_CHANGE"] = "STAGE_CHANGE";
    ActivityType["DEAL_CREATED"] = "DEAL_CREATED";
    ActivityType["CONTACT_CREATED"] = "CONTACT_CREATED";
    ActivityType["MESSAGE_SENT"] = "MESSAGE_SENT";
    ActivityType["MESSAGE_RECEIVED"] = "MESSAGE_RECEIVED";
})(ActivityType || (exports.ActivityType = ActivityType = {}));
//# sourceMappingURL=deal.types.js.map