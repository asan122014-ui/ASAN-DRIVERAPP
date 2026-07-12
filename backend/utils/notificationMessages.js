export const PARENT_NOTIFICATIONS = {
  TRIP_STARTED: {
    title: "Trip Started",
    message:
      "{childName}'s journey has begun. {driverName} has started the trip and is committed to providing a safe and comfortable ride. You can track the trip live in the ASAN app.",
  },

  DRIVER_ARRIVED_PICKUP: {
    title: "Driver Arrived",
    message:
      "{driverName} has arrived at the pickup location and is ready to receive {childName}. Please have your child ready to board safely.",
  },

  CHILD_PICKED_UP: {
    title: "Child Picked Up",
    message:
      "{childName} has been picked up safely by {driverName} and is now on the way to {schoolName}. We'll continue to keep you updated until they arrive safely.",
  },

  APPROACHING_SCHOOL: {
    title: "Approaching School",
    message:
      "The vehicle is approaching {schoolName}. {childName} will arrive safely in just a few moments.",
  },

  DROPPED_AT_SCHOOL: {
    title: "Arrived at School",
    message:
      "{childName} has safely arrived at {schoolName}. Thank you for trusting ASAN with your child's daily transportation.",
  },

  RETURN_TRIP_STARTED: {
    title: "Return Trip Started",
    message:
      "{childName}'s journey home has begun. {driverName} is ensuring a safe and comfortable ride back home.",
  },

  DRIVER_ARRIVED_SCHOOL: {
    title: "Driver Reached School",
    message:
      "{driverName} has arrived at {schoolName} and is ready to receive {childName} safely.",
  },

  PICKED_UP_FROM_SCHOOL: {
    title: "Picked Up From School",
    message:
      "{childName} has been safely picked up from {schoolName} by {driverName} and is now on the way home. We'll notify you as the vehicle gets closer.",
  },

  APPROACHING_HOME: {
    title: "Approaching Home",
    message:
      "The vehicle is approaching your location. {childName} will arrive home in just a few minutes. Please be ready to welcome {childName} home.",
  },

  DROPPED_AT_HOME: {
    title: "Safely Reached Home",
    message:
      "{childName} has safely arrived home. Thank you for trusting ASAN with your child's journey today.",
  },

  TRIP_DELAYED: {
    title: "Trip Delayed",
    message:
      "{childName}'s trip is taking slightly longer than expected due to traffic or road conditions. {driverName} is continuing the journey safely, and your child's safety remains our highest priority.",
  },

  TRIP_CANCELLED: {
    title: "Trip Cancelled",
    message:
      "Today's trip for {childName} has been cancelled. Please contact {driverName} or ASAN support if you require assistance.",
  },

  DRIVER_ASSIGNED: {
    title: "Driver Assigned",
    message:
      "{driverName} has been assigned for {childName}'s transportation. Driver details are now available in the ASAN app.",
  },

  DRIVER_CHANGED: {
    title: "Driver Updated",
    message:
      "{driverName} has been assigned as {childName}'s new driver. Please review the updated driver details in the ASAN app.",
  },

  DRIVER_REQUEST_SUBMITTED: {
    title: "Request Submitted",
    message:
      "Your transportation request for {childName} has been received successfully. We'll notify you once a driver is assigned.",
  },

  DRIVER_REQUEST_ACCEPTED: {
    title: "Request Accepted",
    message:
      "{driverName} has accepted your transportation request for {childName}. Your child's trip has been successfully arranged.",
  },

  GENERAL_ANNOUNCEMENT: {
    title: "Important Update",
    message:
      "A new update regarding {childName}'s transportation is available. Please open the ASAN app for more information.",
  },

  EMERGENCY_ALERT: {
    title: "Safety Alert",
    message:
      "An important safety update has been issued regarding {childName}'s journey. Please review the details immediately in the ASAN app.",
  },

  TRIP_COMPLETED: {
    title: "Trip Completed",
    message:
      "{childName}'s journey has been completed successfully. Thank you for choosing ASAN to care for your child's transportation.",
  },

  PAYMENT_RECEIVED: {
    title: "Payment Received",
    message:
      "Your payment for {childName}'s transportation has been received successfully. Thank you for choosing ASAN.",
  },

  MORNING_DROP_PHOTO_UPLOADED: {
    title: "Arrival Recorded",
    message:
      "{driverName} has submitted the arrival confirmation for {childName} at {schoolName}. Verification is in progress.",
  },

  MORNING_DROP_VERIFIED: {
    title: "Arrival Verified",
    message:
      "{childName}'s arrival at {schoolName} has been verified successfully.",
  },

  AFTERNOON_PICKUP_PHOTO_UPLOADED: {
    title: "Pickup Recorded",
    message:
      "{driverName} has submitted the pickup confirmation for {childName} from {schoolName}. Verification is in progress.",
  },

  AFTERNOON_PICKUP_VERIFIED: {
    title: "Pickup Verified",
    message:
      "{childName}'s pickup from {schoolName} has been verified successfully.",
  },
};

export const DRIVER_NOTIFICATIONS = {
  TRIP_STARTED: {
    title: "Trip Started",
    message:
      "Your assigned trip has started. Please drive safely and ensure every child reaches their destination securely.",
  },

  DRIVER_ARRIVED_PICKUP: {
    title: "Arrived at Pickup",
    message:
      "You have arrived at the pickup location for {childName}. Please ensure they board safely before continuing the trip.",
  },

  CHILD_PICKED_UP: {
    title: "Child Picked Up",
    message:
      "{childName} has boarded safely. Continue your journey to {schoolName} carefully and follow all traffic regulations.",
  },

  APPROACHING_SCHOOL: {
    title: "Near School",
    message:
      "You are approaching {schoolName} with {childName}. Please prepare for a safe and orderly drop-off.",
  },

  DROPPED_AT_SCHOOL: {
    title: "Drop Completed",
    message:
      "{childName} has been safely dropped off at {schoolName}. Thank you for ensuring a safe journey.",
  },

  RETURN_TRIP_STARTED: {
    title: "Return Trip Started",
    message:
      "Your return trip has started. Please follow the assigned route and drive safely.",
  },

  DRIVER_ARRIVED_SCHOOL: {
    title: "Arrived at School",
    message:
      "You have arrived at {schoolName} for {childName}. Please ensure they board the vehicle safely.",
  },

  PICKED_UP_FROM_SCHOOL: {
    title: "Pickup Completed",
    message:
      "{childName} has boarded safely from {schoolName}. Continue towards the home drop-off location.",
  },

  APPROACHING_HOME: {
    title: "Near Destination",
    message:
      "You are approaching {childName}'s home. Please prepare for a safe drop-off.",
  },

  DROPPED_AT_HOME: {
    title: "Child Safely Dropped",
    message:
      "{childName} has been safely dropped off at home. Thank you for your care, responsibility, and commitment to student safety.",
  },

  TRIP_DELAYED: {
    title: "Trip Delayed",
    message:
      "Your trip with {childName} is taking longer than expected. Please continue driving safely and keep student safety as your highest priority.",
  },

  TRIP_CANCELLED: {
    title: "Trip Cancelled",
    message:
      "The trip for {childName} has been cancelled. No further action is required for this assignment.",
  },

  DRIVER_ASSIGNED: {
    title: "New Assignment",
    message:
      "You have been assigned to transport {childName}. Please review the trip details and prepare for a safe journey.",
  },

  DRIVER_CHANGED: {
    title: "Assignment Updated",
    message:
      "You have been assigned as {childName}'s new driver. Please review the updated trip details in the ASAN app.",
  },

  DRIVER_REQUEST_SUBMITTED: {
    title: "New Transport Request",
    message:
      "A new transportation request for {childName} is available. Please review and accept if you're available.",
  },

  DRIVER_REQUEST_ACCEPTED: {
    title: "Request Accepted",
    message:
      "You have accepted the transportation request for {childName}. Please contact the parent if necessary before the trip.",
  },

  GENERAL_ANNOUNCEMENT: {
    title: "Announcement",
    message:
      "A new announcement regarding {childName}'s trip has been posted. Please review it before starting your next trip.",
  },

  EMERGENCY_ALERT: {
    title: "Safety Alert",
    message:
      "An important safety update regarding {childName}'s journey requires your immediate attention. Please follow the provided instructions carefully.",
  },

  TRIP_COMPLETED: {
    title: "Trip Completed",
    message:
      "Today's trip has been completed successfully. Thank you for your professionalism and dedication to keeping every child safe throughout the journey.",
  },

  PAYMENT_RECEIVED: {
    title: "Payment Received",
    message:
      "Payment for {childName}'s trip has been received successfully and has been recorded.",
  },

  MORNING_DROP_PHOTO_UPLOADED: {
    title: "Arrival Recorded",
    message:
      "You have submitted the arrival confirmation for {childName} at {schoolName}. Verification is in progress.",
  },

  MORNING_DROP_VERIFIED: {
    title: "Arrival Verified",
    message:
      "{childName}'s arrival at {schoolName} has been verified successfully.",
  },

  AFTERNOON_PICKUP_PHOTO_UPLOADED: {
    title: "Pickup Recorded",
    message:
      "You have submitted the pickup confirmation for {childName} from {schoolName}. Verification is in progress.",
  },

  AFTERNOON_PICKUP_VERIFIED: {
    title: "Pickup Verified",
    message:
      "{childName}'s pickup from {schoolName} has been verified successfully.",
  },
};
