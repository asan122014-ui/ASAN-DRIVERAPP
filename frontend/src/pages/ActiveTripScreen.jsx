import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import axios from "../utils/axiosInstance";

import {
  GoogleMap,
  DirectionsRenderer,
  Marker,
  OverlayView,
} from "@react-google-maps/api";

import driverNavigationPointer from "../assets/driver-navigation-pointer.png";

import {
  uploadMorningDropPhoto,
  uploadAfternoonPickupPhoto,
} from "../api/trip";

import CameraCapture from "../components/CameraCapture";

import {
  Geolocation,
} from "@capacitor/geolocation";

import {
  Capacitor,
} from "@capacitor/core";

import {
  socket,
} from "../utils/socket";

import {
  Users,
  Clock3,
  MapPin,
  Navigation,
  UserCheck,
  CircleDot,
  CheckCircle2,
  UserX,
  Route,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  X,
  Flag,
  Timer,
  Loader2,
  LocateFixed,
} from "lucide-react";

/* =========================================================
   GOOGLE MAP
========================================================= */

const GOOGLE_KEY =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const containerStyle = {
  width: "100%",
  height: "100%",
};

const DEFAULT_MAP_CENTER = {
  lat: 17.385044,
  lng: 78.486671,
};

/* =========================================================
   TRIP SETTINGS
========================================================= */

const MAX_TRIP_DURATION_MS =
  3 * 60 * 60 * 1000;

/*
 * Driver must be within this distance
 * of the final ride destination.
 */
const END_TRIP_RADIUS_METERS =
  500;

/* =========================================================
   HELPERS
========================================================= */

const isEveningNow = () =>
  new Date().getHours() >= 12;

const formatRecordedTime =
  (value) => {
    if (!value) {
      return "--";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "--";
    }

    return date.toLocaleTimeString(
      [],
      {
        hour:
          "2-digit",

        minute:
          "2-digit",
      }
    );
  };

/* =========================================================
   VALID COORDINATES
========================================================= */

const isValidCoordinate = (
  value
) =>
  Number.isFinite(
    Number(value)
  );

/* =========================================================
   HAVERSINE DISTANCE

   Returns distance in metres.
========================================================= */

const calculateDistanceMeters = (
  pointA,
  pointB
) => {
  if (
    !pointA ||
    !pointB
  ) {
    return Infinity;
  }

  const lat1 =
    Number(
      pointA.lat
    );

  const lng1 =
    Number(
      pointA.lng
    );

  const lat2 =
    Number(
      pointB.lat
    );

  const lng2 =
    Number(
      pointB.lng
    );

  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lng1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lng2)
  ) {
    return Infinity;
  }

  const R =
    6371000;

  const toRadians =
    (degrees) =>
      (degrees *
        Math.PI) /
      180;

  const dLat =
    toRadians(
      lat2 -
        lat1
    );

  const dLng =
    toRadians(
      lng2 -
        lng1
    );

  const a =
    Math.sin(
      dLat / 2
    ) **
      2 +
    Math.cos(
      toRadians(
        lat1
      )
    ) *
      Math.cos(
        toRadians(
          lat2
        )
      ) *
      Math.sin(
        dLng / 2
      ) **
        2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(
        1 - a
      )
    );

  return R * c;
};

const calculateBearing = (
  start,
  end
) => {
  if (
    !start ||
    !end
  ) {
    return 0;
  }

  const toRadians =
    (degrees) =>
      degrees *
      (Math.PI / 180);

  const startLat =
    toRadians(
      Number(start.lat)
    );

  const endLat =
    toRadians(
      Number(end.lat)
    );

  const longitudeDelta =
    toRadians(
      Number(end.lng) -
      Number(start.lng)
    );

  const y =
    Math.sin(
      longitudeDelta
    ) *
    Math.cos(
      endLat
    );

  const x =
    Math.cos(
      startLat
    ) *
      Math.sin(
        endLat
      ) -
    Math.sin(
      startLat
    ) *
      Math.cos(
        endLat
      ) *
      Math.cos(
        longitudeDelta
      );

  return (
    Math.atan2(
      y,
      x
    ) *
      (180 / Math.PI) +
    360
  ) % 360;
};

/* =========================================================
   FORMAT DISTANCE
========================================================= */

const formatDistance = (
  distance
) => {
  if (
    !Number.isFinite(
      distance
    )
  ) {
    return "--";
  }

  if (
    distance < 1000
  ) {
    return `${Math.round(
      distance
    )} m`;
  }

  return `${(
    distance / 1000
  ).toFixed(1)} km`;
};

/* =========================================================
   MARKER ICON
========================================================= */

const createIcon = (
  color
) => {
  if (
    !window.google?.maps
  ) {
    return null;
  }

  return {
    path:
      window.google.maps
        .SymbolPath.CIRCLE,

    fillColor:
      color,

    fillOpacity:
      0.9,

    strokeColor:
      "#FFFFFF",

    strokeWeight:
      2,

    scale:
      10,

    labelOrigin:
      new window.google.maps.Point(
        0,
        -15
      ),
  };
};

/* =========================================================
   ACTIVE TRIP
========================================================= */

function ActiveTripScreen({
  onEndTrip,
}) {
  const navigate =
    useNavigate();

  /* =======================================================
     GOOGLE MAPS

     App.jsx owns the single Google Maps loader. This screen
     renders only after that loader has completed.
  ======================================================= */

  const mapsLoaded =
    typeof window !== "undefined" &&
    Boolean(window.google?.maps);

  const mapsLoadError = null;

  /* =======================================================
     STATE
  ======================================================= */

  const [
    students,
    setStudents,
  ] = useState([]);

  const [
    driverLocation,
    setDriverLocation,
  ] = useState(null);

  const [
    animatedDriverLocation,
    setAnimatedDriverLocation,
  ] = useState(null);

  const [
    directions,
    setDirections,
  ] = useState(null);

  const [
    eta,
    setEta,
  ] = useState("--");

  const [
    nextStudent,
    setNextStudent,
  ] = useState(null);

  const [
    showEndPopup,
    setShowEndPopup,
  ] = useState(false);

  /*
   * Shows when the driver tries to end
   * the trip outside the 500 m radius.
   */
  const [
    showDistancePopup,
    setShowDistancePopup,
  ] = useState(false);

  const [
    endTripDistance,
    setEndTripDistance,
  ] = useState(null);

  const [
    showAllStudents,
    setShowAllStudents,
  ] = useState(false);

  const [
    tripProgress,
    setTripProgress,
  ] = useState({
    totalStudents: 0,
    pickedStudents: 0,
    droppedStudents: 0,
    remainingStudents: 0,
  });

  const [
    tripDuration,
    setTripDuration,
  ] = useState(
    "00:00:00"
  );

  const [
    tripStartTime,
    setTripStartTime,
  ] = useState(null);

  const [
    activeTripType,
    setActiveTripType,
  ] = useState(null);

  const [
    processingTripId,
    setProcessingTripId,
  ] = useState(null);

  const [
    selectedTrip,
    setSelectedTrip,
  ] = useState(null);

  const [
    showPhotoModal,
    setShowPhotoModal,
  ] = useState(false);

  const [
    photoType,
    setPhotoType,
  ] = useState("");

  const [
    showMap,
    setShowMap,
  ] = useState(false);

  const [
    isUploading,
    setIsUploading,
  ] = useState(false);

  const [
    tripPhase,
    setTripPhase,
  ] = useState(
    "pickup"
  );

  const [
    endingTrip,
    setEndingTrip,
  ] = useState(false);

  /* =======================================================
     REFS
  ======================================================= */

  const pollingRef =
    useRef(null);

const backgroundWatchId =
    useRef(null);

  const foregroundWatchId =
    useRef(null);

  const directionsServiceRef =
    useRef(null);

  const spokenRef =
    useRef(false);

  const mapRef =
    useRef(null);

  const previousStudentRef =
    useRef(null);

  const lastRouteCall =
    useRef(0);

  const driverRef =
    useRef(null);

  const lastDriverPosition =
    useRef(null);

  const animatedDriverPositionRef =
    useRef(null);

  const driverMarkerFrameRef =
    useRef(null);

  const lastRouteDestination =
    useRef(null);

  const isEveningTrip =
    useCallback(
      () =>
        activeTripType
          ? activeTripType === "afternoon"
          : isEveningNow(),
      [activeTripType]
    );

  /*
   * Final real ride destination.
   *
   * This remains stored even after the
   * student's server status changes to
   * "dropped".
   */
  const lastRideLocationRef =
    useRef(null);

  /*
   * Student ID / trip ID whose destination
   * generated lastRideLocationRef.
   */
  const lastRideTripRef =
    useRef(null);

  /* =======================================================
     AUTO END LOCK
  ======================================================= */

  const autoEndTriggeredRef =
    useRef(false);

  /* =======================================================
     DRIVER
  ======================================================= */

  const driver =
    useMemo(
      () => {
        try {
          const data =
            localStorage.getItem(
              "driver"
            );

          return data
            ? JSON.parse(
                data
              )
            : null;
        } catch {
          return null;
        }
      },
      []
    );

  useEffect(() => {
    driverRef.current =
      driver;
  }, [driver]);

  /* =======================================================
     AUTHENTICATED LIVE-TRIP SOCKET
  ======================================================= */

  useEffect(() => {
    const token =
      localStorage.getItem(
        "accessToken"
      );

    if (
      !token ||
      !driver?.driverId
    ) {
      return;
    }

    socket.auth = {
      token,
    };

    const joinDriverRoom =
      () => {
        socket.emit(
          "join_driver_room",
          {
            driverId:
              driver.driverId,
          }
        );
      };

    const handleConnectError =
      (error) => {
        console.error(
          "Live trip socket error:",
          error.message
        );
      };

    socket.on(
      "connect",
      joinDriverRoom
    );

    socket.on(
      "connect_error",
      handleConnectError
    );

    if (
      socket.connected
    ) {
      joinDriverRoom();
    } else {
      socket.connect();
    }

    return () => {
      socket.off(
        "connect",
        joinDriverRoom
      );

      socket.off(
        "connect_error",
        handleConnectError
      );

      socket.disconnect();
    };
  }, [
    driver?.driverId,
  ]);

  /* =======================================================
     MAP ICONS
  ======================================================= */

  const studentIcons =
    useMemo(
      () => {
        if (
          !mapsLoaded ||
          !window.google
            ?.maps
        ) {
          return {
            waiting: null,
            picked_up: null,
            onboard: null,
            dropped: null,
            absent: null,
            default: null,
          };
        }

        return {
          waiting:
            createIcon(
              "#FBBF24"
            ),

          picked_up:
            createIcon(
              "#3B82F6"
            ),

          onboard:
            createIcon(
              "#10B981"
            ),

          dropped:
            createIcon(
              "#8B5CF6"
            ),

          absent:
            createIcon(
              "#EF4444"
            ),

          default:
            createIcon(
              "#9CA3AF"
            ),
        };
      },
      [mapsLoaded]
    );

  /* =======================================================
     GOOGLE SERVICES
  ======================================================= */

  useEffect(() => {
    if (
      !mapsLoaded ||
      !window.google
        ?.maps
    ) {
      return;
    }

    if (
      !directionsServiceRef.current
    ) {
      directionsServiceRef.current =
        new window.google.maps.DirectionsService();
    }
  }, [
    mapsLoaded,
  ]);

  /* =======================================================
     STUDENT COORDS

     PICKUP PHASE
       Morning -> pickup/home
       Evening -> school/drop location

     DROP PHASE
       Morning -> school/drop location
       Evening -> home
  ======================================================= */

  const getCoords =
    useCallback(
      (student) => {
        if (!student) {
          return null;
        }

        if (
          tripPhase ===
          "pickup"
        ) {
          return isEveningTrip()
            ? student.dropLocationCoords
            : student.location;
        }

        return isEveningTrip()
          ? student.location
          : student.dropLocationCoords;
      },
      [tripPhase, isEveningTrip]
    );

  /* =======================================================
     FINAL DESTINATION FOR A STUDENT

     This does not depend upon mutable tripPhase.

     The destination at which the student's
     ride is COMPLETE is:

       Morning:
         school / dropLocationCoords

       Evening:
         home / location
  ======================================================= */

  const getFinalRideCoords =
    useCallback(
      (student) => {
        if (!student) {
          return null;
        }

        const coords =
          isEveningTrip()
            ? student.location
            : student.dropLocationCoords;

        if (
          !isValidCoordinate(
            coords?.lat
          ) ||
          !isValidCoordinate(
            coords?.lng
          )
        ) {
          return null;
        }

        return {
          lat:
            Number(
              coords.lat
            ),

          lng:
            Number(
              coords.lng
            ),
        };
      },
      [isEveningTrip]
    );

  /* =======================================================
     REMEMBER FINAL RIDE LOCATION
  ======================================================= */

  const rememberFinalRideLocation =
    useCallback(
      (
        student
      ) => {
        const coords =
          getFinalRideCoords(
            student
          );

        if (!coords) {
          return;
        }

        lastRideLocationRef.current =
          coords;

        lastRideTripRef.current =
          student.tripId ||
          student._id ||
          null;

        console.log(
          "Final ride destination stored:",
          coords
        );
      },
      [
        getFinalRideCoords,
      ]
    );

  /* =======================================================
     FIND STUDENT FROM TRIP ID
  ======================================================= */

  const findStudentByTripId =
    useCallback(
      (tripId) => {
        return (
          students.find(
            (student) =>
              String(
                student.tripId
              ) ===
              String(
                tripId
              )
          ) || null
        );
      },
      [students]
    );

  /* =======================================================
     MAP CENTER
  ======================================================= */

  const fallbackCenter =
    useMemo(
      () => {
        if (
          driverLocation
        ) {
          return driverLocation;
        }

        for (
          const student of
          students
        ) {
          if (
            isValidCoordinate(
              student.location
                ?.lat
            ) &&
            isValidCoordinate(
              student.location
                ?.lng
            )
          ) {
            return {
              lat:
                Number(
                  student.location
                    .lat
                ),

              lng:
                Number(
                  student.location
                    .lng
                ),
            };
          }

          if (
            isValidCoordinate(
              student
                .dropLocationCoords
                ?.lat
            ) &&
            isValidCoordinate(
              student
                .dropLocationCoords
                ?.lng
            )
          ) {
            return {
              lat:
                Number(
                  student
                    .dropLocationCoords
                    .lat
                ),

              lng:
                Number(
                  student
                    .dropLocationCoords
                    .lng
                ),
            };
          }
        }

        return DEFAULT_MAP_CENTER;
      },
      [
        students,
        driverLocation,
      ]
    );

  const safeDriverLocation =
    useMemo(
      () => {
        if (
          driverLocation &&
          isValidCoordinate(
            driverLocation.lat
          ) &&
          isValidCoordinate(
            driverLocation.lng
          )
        ) {
          return {
            lat:
              Number(
                driverLocation.lat
              ),

            lng:
              Number(
                driverLocation.lng
              ),
          };
        }

        return fallbackCenter;
      },
      [
        driverLocation,
        fallbackCenter,
      ]
    );

  /* =======================================================
     SMOOTH DRIVER POINTER
  ======================================================= */

  useEffect(() => {
    if (
      !driverLocation ||
      !isValidCoordinate(
        driverLocation.lat
      ) ||
      !isValidCoordinate(
        driverLocation.lng
      )
    ) {
      return;
    }

    const target = {
      lat:
        Number(
          driverLocation.lat
        ),

      lng:
        Number(
          driverLocation.lng
        ),
    };

    const start =
      animatedDriverPositionRef
        .current ||
      target;

    const movement =
      calculateDistanceMeters(
        start,
        target
      );

    const nextHeading =
      Number.isFinite(
        movement
      ) &&
      movement >= 1
        ? calculateBearing(
            start,
            target
          )
        : null;

    if (
      driverMarkerFrameRef
        .current
    ) {
      window.cancelAnimationFrame(
        driverMarkerFrameRef
          .current
      );
    }

    let startedAt =
      null;

    const duration =
      850;

    const animate =
      (
        timestamp
      ) => {
        if (
          startedAt ===
          null
        ) {
          startedAt =
            timestamp;

          if (
            nextHeading !==
            null
          ) {
            // Navigation mode: turn the map to the vehicle's live heading.
            // The driver arrow itself remains upright at the top of the screen.
            mapRef.current?.setHeading(
              nextHeading
            );
          }
        }

        const progress =
          Math.min(
            (timestamp -
              startedAt) /
              duration,
            1
          );

        const easedProgress =
          1 -
          Math.pow(
            1 - progress,
            3
          );

        const position = {
          lat:
            start.lat +
            (target.lat -
              start.lat) *
              easedProgress,

          lng:
            start.lng +
            (target.lng -
              start.lng) *
              easedProgress,
        };

        animatedDriverPositionRef.current =
          position;

        setAnimatedDriverLocation(
          position
        );

        if (
          progress < 1
        ) {
          driverMarkerFrameRef.current =
            window.requestAnimationFrame(
              animate
            );
        }
      };

    driverMarkerFrameRef.current =
      window.requestAnimationFrame(
        animate
      );

    return () => {
      if (
        driverMarkerFrameRef
          .current
      ) {
        window.cancelAnimationFrame(
          driverMarkerFrameRef
            .current
        );
      }
    };
  }, [
    driverLocation,
  ]);

  /* =======================================================
     COMPLETION STATUS
  ======================================================= */

  const allAbsent =
    useMemo(
      () => {
        if (
          students.length ===
          0
        ) {
          return false;
        }

        return students.every(
          (student) =>
            student.status ===
            "absent"
        );
      },
      [students]
    );

  /*
   * Every student has been fully handled.
   */
  const allStudentsCompleted =
    useMemo(
      () => {
        if (
          students.length ===
          0
        ) {
          return false;
        }

        return students.every(
          (student) =>
            student.status ===
              "dropped" ||
            student.status ===
              "absent"
        );
      },
      [students]
    );

  /*
   * There was at least one actual rider.
   */
  const hasCompletedRide =
    useMemo(
      () =>
        students.some(
          (student) =>
            student.status ===
            "dropped"
        ),
      [students]
    );

  /* =======================================================
     REBUILD LAST DESTINATION AFTER RELOAD

     If the screen reloads after all children
     were dropped, lastRideLocationRef would
     otherwise be empty.

     We use the most recently dropped student.
  ======================================================= */

  useEffect(() => {
    if (
      !students.length
    ) {
      return;
    }

    if (
      lastRideLocationRef.current
    ) {
      return;
    }

    const droppedStudents =
      students.filter(
        (student) =>
          student.status ===
          "dropped"
      );

    if (
      !droppedStudents.length
    ) {
      return;
    }

    /*
     * Prefer newest recorded dropTime.
     */
    const sorted = [
      ...droppedStudents,
    ].sort(
      (
        a,
        b
      ) => {
        const aTime =
          a.dropTime
            ? new Date(
                a.dropTime
              ).getTime()
            : 0;

        const bTime =
          b.dropTime
            ? new Date(
                b.dropTime
              ).getTime()
            : 0;

        return (
          bTime -
          aTime
        );
      }
    );

    const latest =
      sorted[0];

    rememberFinalRideLocation(
      latest
    );
  }, [
    students,
    rememberFinalRideLocation,
  ]);

  /* =======================================================
     DISTANCE TO FINAL LOCATION
  ======================================================= */

  const distanceToFinalLocation =
    useMemo(
      () => {
        if (
          allAbsent
        ) {
          return 0;
        }

        return calculateDistanceMeters(
          driverLocation,
          lastRideLocationRef.current
        );
      },
      [
        driverLocation,
        allAbsent,
        students,
      ]
    );

  const insideEndRadius =
    allAbsent ||
    (
      Number.isFinite(
        distanceToFinalLocation
      ) &&
      distanceToFinalLocation <=
        END_TRIP_RADIUS_METERS
    );

  /* =======================================================
     PROGRESS
  ======================================================= */

  const total =
    tripProgress.totalStudents ||
    students.length;

  const picked =
    students.filter(
      (student) =>
        student.status ===
          "onboard" ||
        student.status ===
          "picked_up"
    ).length;

  const dropped =
    students.filter(
      (student) =>
        student.status ===
        "dropped"
    ).length;

  /*
   * Use actual student status as a backup because
   * progress API may update a fraction later.
   */
  const actualRemaining =
    students.filter(
      (student) =>
        student.status !==
          "dropped" &&
        student.status !==
          "absent"
    ).length;

  const awaitingPickup =
    students.filter(
      (student) =>
        student.status ===
        "waiting"
    ).length;

  const progress =
    useMemo(
      () => {
        if (
          total <= 0
        ) {
          return 0;
        }

        const completed =
          students.filter(
            (student) =>
              student.status ===
                "onboard" ||
              student.status ===
                "picked_up" ||
              student.status ===
                "dropped" ||
              student.status ===
                "absent"
          ).length;

        return (
          completed /
          total
        ) *
          100;
      },
      [
        total,
        students,
      ]
    );

  /* =======================================================
     VISIBLE STUDENTS
  ======================================================= */

  const displayLimit =
    10;

  const visibleStudents =
    useMemo(
      () => {
        return showAllStudents
          ? students
          : students.slice(
              0,
              displayLimit
            );
      },
      [
        students,
        showAllStudents,
      ]
    );

  const hasMoreStudents =
    students.length >
    displayLimit;

  /* =======================================================
     LOCATION PERMISSION
  ======================================================= */

  const requestLocationPermission =
    async () => {
      try {
        if (
          !Capacitor.isNativePlatform()
        ) {
          return Boolean(
            navigator.geolocation
          );
        }

        const permission =
          await Geolocation.requestPermissions();

        const granted =
          permission.location ===
            "granted" ||
          permission.coarseLocation ===
            "granted";

        if (granted) {
          return true;
        }

        alert(
          "Please enable location permission to track your trip."
        );

        return false;
      } catch (error) {
        console.error(
          "Location permission error:",
          error
        );

        return false;
      }
    };

  /* =======================================================
     SEND LOCATION
  ======================================================= */

  const sendLocationToServer =
    useCallback(
      (
        lat,
        lng
      ) => {
        if (
          !driverRef.current
        ) {
          return;
        }

        const newLocation = {
          lat:
            Number(lat),

          lng:
            Number(lng),
        };

        setDriverLocation(
          newLocation
        );

        socket.emit(
          "send_location",
          {
            driverId:
              driverRef.current
                .driverId,

            lat:
              Number(lat),

            lng:
              Number(lng),

            eta,
          }
        );
      },
      [eta]
    );

  /* =======================================================
     STOP NATIVE TRACKING
  ======================================================= */

  const stopBackgroundTracking =
    useCallback(
      async () => {
        try {
          if (
            backgroundWatchId.current !==
            null
          ) {
            await Geolocation.clearWatch(
              {
                id:
                  backgroundWatchId.current,
              }
            );

            backgroundWatchId.current =
              null;
          }
        } catch (error) {
          console.error(
            "Error stopping native tracking:",
            error
          );
        }
      },
      []
    );

  /* =======================================================
     STOP WEB TRACKING
  ======================================================= */

  const stopForegroundTracking =
    useCallback(
      () => {
        if (
          foregroundWatchId.current !==
          null &&
          navigator.geolocation
        ) {
          navigator.geolocation.clearWatch(
            foregroundWatchId.current
          );

          foregroundWatchId.current =
            null;
        }
      },
      []
    );

  /* =======================================================
     WEB GPS
  ======================================================= */

  const startForegroundTracking =
    useCallback(
      () => {
        if (
          foregroundWatchId.current !==
          null
        ) {
          return;
        }

        if (
          !navigator.geolocation
        ) {
          console.error(
            "Browser geolocation not supported"
          );

          return;
        }

        const watchId =
          navigator.geolocation.watchPosition(
            (
              position
            ) => {
              const {
                latitude,
                longitude,
              } =
                position.coords;

              sendLocationToServer(
                latitude,
                longitude
              );
            },

            (
              error
            ) => {
              console.error(
                "Browser GPS error:",
                error
              );

              if (
                import.meta.env.DEV
              ) {
                console.warn(
                  "Using Hyderabad development fallback"
                );

                sendLocationToServer(
                  17.385044,
                  78.486671
                );
              }
            },

            {
              enableHighAccuracy:
                true,

              maximumAge:
                3000,

              timeout:
                15000,
            }
          );

        foregroundWatchId.current =
          watchId;
      },
      [
        sendLocationToServer,
      ]
    );

  /* =======================================================
     NATIVE / WEB TRACKING
  ======================================================= */

  const startLocationTracking =
    useCallback(
      async () => {
        try {
          if (
            !Capacitor.isNativePlatform()
          ) {
            stopForegroundTracking();

            startForegroundTracking();

            return;
          }

          await stopBackgroundTracking();

          stopForegroundTracking();

          const hasPermission =
            await requestLocationPermission();

          if (
            !hasPermission
          ) {
            return;
          }

          const watchId =
            await Geolocation.watchPosition(
              {
                enableHighAccuracy:
                  true,

                timeout:
                  10000,

                maximumAge:
                  0,
              },

              (
                position,
                error
              ) => {
                if (error) {
                  console.error(
                    "Native GPS error:",
                    error
                  );

                  return;
                }

                if (
                  !position
                ) {
                  return;
                }

                const {
                  latitude,
                  longitude,
                } =
                  position.coords;

                sendLocationToServer(
                  latitude,
                  longitude
                );
              }
            );

          backgroundWatchId.current =
            watchId;
        } catch (error) {
          console.error(
            "Location tracking error:",
            error
          );

          if (
            !Capacitor.isNativePlatform()
          ) {
            startForegroundTracking();
          }
        }
      },
      [
        sendLocationToServer,
        startForegroundTracking,
        stopForegroundTracking,
        stopBackgroundTracking,
      ]
    );

  /* =======================================================
     FETCH STUDENTS
  ======================================================= */

  const fetchStudents =
    useCallback(
      async () => {
        try {
          if (
            !driver?.driverId
          ) {
            return;
          }

          const response =
            await axios.get(
              `/children/driver/${driver.driverId}`
            );

          const data =
            response.data?.data ||
            [];

          if (
            !Array.isArray(
              data
            )
          ) {
            setStudents([]);

            return;
          }

          setStudents(
            data
          );
        } catch (error) {
          console.error(
            "Students fetch failed:",
            error?.response?.data ||
              error
          );

          setStudents([]);
        }
      },
      [
        driver?.driverId,
      ]
    );

  /* =======================================================
     FETCH PROGRESS
  ======================================================= */

  const fetchTripProgress =
    useCallback(
      async () => {
        try {
          if (
            !driver?.driverId
          ) {
            return;
          }

          const response =
            await axios.get(
              `/trip/progress/${driver.driverId}`
            );

          if (
            response.data
              ?.success
          ) {
            setTripProgress(
              response.data
                .data
            );
          }
        } catch (error) {
          console.error(
            "Progress error:",
            error
          );
        }
      },
      [
        driver?.driverId,
      ]
    );

  /* =======================================================
     FETCH ACTIVE TRIP
  ======================================================= */

  const fetchActiveTrip =
    useCallback(
      async () => {
        try {
          if (
            !driver?.driverId
          ) {
            return;
          }

          const response =
            await axios.get(
              `/trip/active/${driver.driverId}`
            );

          const activeTrips =
            Array.isArray(
              response.data?.data
            )
              ? response.data.data
              : [];

          if (
            activeTrips.length >
            0
          ) {
            const trip =
              activeTrips[0];

            setActiveTripType(
              trip.tripType || null
            );

            if (
              trip.startTime
            ) {
              setTripStartTime(
                trip.startTime
              );

              autoEndTriggeredRef.current =
                false;
            }
          }
        } catch (error) {
          console.error(
            "Active trip fetch failed:",
            error
          );
        }
      },
      [
        driver?.driverId,
      ]
    );

  /* =======================================================
     BEST STUDENT
  ======================================================= */

  const getBestStudent =
    useCallback(
      async (
        origin,
        studentsList
      ) => {
        if (
          !studentsList.length ||
          !origin
        ) {
          return null;
        }

        const validStudents =
          studentsList.filter(
            (
              student
            ) => {
              const coords =
                getCoords(
                  student
                );

              return (
                isValidCoordinate(
                  coords?.lat
                ) &&
                isValidCoordinate(
                  coords?.lng
                )
              );
            }
          );

        if (
          !validStudents.length
        ) {
          return null;
        }

        const nearest =
          validStudents.reduce(
            (best, student) => {
              const coords =
                getCoords(student);

              const distance =
                calculateDistanceMeters(
                  origin,
                  coords
                );

              if (
                !Number.isFinite(distance)
              ) {
                return best;
              }

              if (
                !best ||
                distance < best.distance
              ) {
                return {
                  student,
                  distance,
                };
              }

              return best;
            },
            null
          );

        return nearest
          ? {
              ...nearest.student,
              phase: tripPhase,
            }
          : null;
      },
      [
        tripPhase,
        getCoords,
      ]
    );

  /* =======================================================
     ROUTE
  ======================================================= */

  const calculateRoute =
    useCallback(
      (
        origin,
        destination
      ) => {
        if (
          !mapRef.current ||
          !mapsLoaded ||
          !window.google
            ?.maps ||
          !origin ||
          !destination ||
          !directionsServiceRef.current
        ) {
          return;
        }

        /*
         * Avoid route refresh for tiny GPS movement.
         */
        const destinationKey =
          `${Number(destination.lat).toFixed(6)},${Number(destination.lng).toFixed(6)}`;

        const destinationChanged =
          lastRouteDestination.current !==
          destinationKey;

        if (
          !destinationChanged &&
          lastDriverPosition.current
        ) {
          const moved =
            calculateDistanceMeters(
              lastDriverPosition.current,
              origin
            );

          if (
            moved < 20
          ) {
            return;
          }
        }

        lastDriverPosition.current =
          {
            lat:
              Number(
                origin.lat
              ),

            lng:
              Number(
                origin.lng
              ),
          };

        lastRouteDestination.current =
          destinationKey;

        const now =
          Date.now();

        if (
          now -
            lastRouteCall.current <
          5000
        ) {
          return;
        }

        lastRouteCall.current =
          now;

        directionsServiceRef.current.route(
          {
            origin: {
              lat:
                Number(
                  origin.lat
                ),

              lng:
                Number(
                  origin.lng
                ),
            },

            destination: {
              lat:
                Number(
                  destination.lat
                ),

              lng:
                Number(
                  destination.lng
                ),
            },

            travelMode:
              window.google.maps
                .TravelMode
                .DRIVING,

            drivingOptions:
              {
                departureTime:
                  new Date(),

                trafficModel:
                  window.google.maps
                    .TrafficModel
                    .BEST_GUESS,
              },
          },

          (
            response,
            status
          ) => {
            if (
              status !==
                "OK" ||
              !response?.routes
                ?.length
            ) {
              console.error(
                "Directions route failed:",
                status,
                {
                  origin,
                  destination,
                }
              );

              return;
            }

            setDirections(
              response
            );

            const leg =
              response.routes[0]
                .legs[0];

            if (!leg) {
              return;
            }

            const etaText =
              leg
                .duration_in_traffic
                ?.text ||
              leg.duration?.text ||
              "--";

            setEta(
              etaText
            );

            if (
              leg.duration
                ?.value <
                120 &&
              !spokenRef.current
            ) {
              spokenRef.current =
                true;

              try {
                const message =
                  new SpeechSynthesisUtterance(
                    "Arriving in 2 minutes"
                  );

                window.speechSynthesis.speak(
                  message
                );
              } catch (
                error
              ) {
                console.warn(
                  "Speech unavailable:",
                  error
                );
              }
            }

            if (
              mapRef.current
            ) {
              const bounds =
                new window.google.maps.LatLngBounds();

              bounds.extend(
                origin
              );

              bounds.extend(
                destination
              );

              mapRef.current.fitBounds(
                bounds
              );
            }
          }
        );
      },
      [
        mapsLoaded,
      ]
    );

  /* =======================================================
     RESET VOICE
  ======================================================= */

  useEffect(() => {
    spokenRef.current =
      false;
  }, [nextStudent]);

  /* =======================================================
     NEXT STUDENT
  ======================================================= */

  useEffect(() => {
    if (
      !driverLocation ||
      !students.length ||
      !mapsLoaded
    ) {
      return;
    }

    const active =
      students.filter(
        (
          student
        ) => {
          if (
            tripPhase ===
            "pickup"
          ) {
            return (
              student.status ===
              "waiting"
            );
          }

          return (
            student.status ===
              "onboard" ||
            student.status ===
              "picked_up"
          );
        }
      );

    if (
      !active.length
    ) {
      setNextStudent(
        null
      );

      return;
    }

    const timer =
      window.setTimeout(
        async () => {
          const best =
            await getBestStudent(
              driverLocation,
              active
            );

          if (best) {
            setNextStudent(
              best
            );

            /*
             * During drop phase this is a
             * candidate final ride destination.
             *
             * The actual final student is stored
             * again when Drop is pressed.
             */
            if (
              tripPhase ===
              "drop"
            ) {
              rememberFinalRideLocation(
                best
              );
            }

            if (
              previousStudentRef.current !==
              best._id
            ) {
              previousStudentRef.current =
                best._id;

              setDirections(
                null
              );
            }
          }
        },
        500
      );

    return () =>
      window.clearTimeout(
        timer
      );
  }, [
    students,
    driverLocation,
    tripPhase,
    getBestStudent,
    mapsLoaded,
    rememberFinalRideLocation,
  ]);

  /* =======================================================
     ROUTE TO NEXT STUDENT
  ======================================================= */

  useEffect(() => {
    if (
      !driverLocation ||
      !nextStudent ||
      !mapsLoaded ||
      !window.google
        ?.maps
    ) {
      return;
    }

    const target =
      getCoords(
        nextStudent
      );

    if (
      !isValidCoordinate(
        target?.lat
      ) ||
      !isValidCoordinate(
        target?.lng
      )
    ) {
      return;
    }

    const timer =
      window.setTimeout(
        () => {
          calculateRoute(
            {
              lat:
                Number(
                  driverLocation.lat
                ),

              lng:
                Number(
                  driverLocation.lng
                ),
            },

            {
              lat:
                Number(
                  target.lat
                ),

              lng:
                Number(
                  target.lng
                ),
            }
          );
        },
        500
      );

    return () =>
      window.clearTimeout(
        timer
      );
  }, [
    nextStudent,
    tripPhase,
    driverLocation,
    calculateRoute,
    getCoords,
    mapsLoaded,
  ]);

  /* =======================================================
     ROUTE REFRESH
  ======================================================= */

  useEffect(() => {
    if (
      !driverLocation ||
      !nextStudent ||
      !mapsLoaded
    ) {
      return;
    }

    const interval =
      window.setInterval(
        () => {
          const target =
            getCoords(
              nextStudent
            );

          if (
            !isValidCoordinate(
              target?.lat
            ) ||
            !isValidCoordinate(
              target?.lng
            )
          ) {
            return;
          }

          calculateRoute(
            {
              lat:
                Number(
                  driverLocation.lat
                ),

              lng:
                Number(
                  driverLocation.lng
                ),
            },

            {
              lat:
                Number(
                  target.lat
                ),

              lng:
                Number(
                  target.lng
                ),
            }
          );
        },
        30000
      );

    return () =>
      window.clearInterval(
        interval
      );
  }, [
    nextStudent,
    driverLocation,
    calculateRoute,
    getCoords,
    mapsLoaded,
  ]);

  /* =======================================================
     ROUTE TO FINAL LOCATION
  ======================================================= */

  useEffect(() => {
    if (
      !allStudentsCompleted ||
      allAbsent ||
      !driverLocation ||
      !mapsLoaded ||
      !lastRideLocationRef.current
    ) {
      return;
    }

    calculateRoute(
      driverLocation,
      lastRideLocationRef.current
    );
  }, [
    allStudentsCompleted,
    allAbsent,
    driverLocation,
    mapsLoaded,
    calculateRoute,
    students,
  ]);

  /* =======================================================
     END TRIP
  ======================================================= */

  const endTrip =
    useCallback(
      async (
        options = {}
      ) => {
        const automatic =
          options.automatic ===
          true;

        if (
          automatic &&
          autoEndTriggeredRef.current
        ) {
          return;
        }

        if (
          automatic
        ) {
          autoEndTriggeredRef.current =
            true;
        }

        try {
          setEndingTrip(
            true
          );

          if (
            pollingRef.current
          ) {
            clearInterval(
              pollingRef.current
            );

            pollingRef.current =
              null;
          }

          const response =
            await axios.post(
              "/trip/end",
              {
                driverId:
                  driver?.driverId,

                autoEnded:
                  automatic,

                endReason:
                  automatic
                    ? "maximum_trip_duration_reached"
                    : "manual",
              }
            );

          if (
            onEndTrip
          ) {
            onEndTrip(
              response.data
                ?.data
            );
          }

          setStudents([]);

          setNextStudent(
            null
          );

          setDirections(
            null
          );

          setTripProgress({
            totalStudents: 0,
            pickedStudents: 0,
            droppedStudents: 0,
            remainingStudents: 0,
          });

          setTripDuration(
            "00:00:00"
          );

          setTripStartTime(
            null
          );

          setActiveTripType(
            null
          );

          setTripPhase(
            "pickup"
          );

          setSelectedTrip(
            null
          );

          setPhotoType("");

          setShowPhotoModal(
            false
          );

          setShowEndPopup(
            false
          );

          setShowDistancePopup(
            false
          );

          lastRideLocationRef.current =
            null;

          lastRideTripRef.current =
            null;

          await stopBackgroundTracking();

          stopForegroundTracking();
          navigate(
            "/trip-success",
            {
              replace:
                true,

              state: {
                ...response.data,

                autoEnded:
                  automatic,

                endReason:
                  automatic
                    ? "maximum_trip_duration_reached"
                    : "manual",
              },
            }
          );
        } catch (error) {
          console.error(
            automatic
              ? "Automatic trip end failed:"
              : "Trip end failed:",
            error?.response?.data ||
              error
          );

          if (
            automatic
          ) {
            autoEndTriggeredRef.current =
              false;

            return;
          }

          alert(
            error.response
              ?.data
              ?.message ||
              "Failed to end trip."
          );
        } finally {
          setEndingTrip(
            false
          );
        }
      },
      [
        driver?.driverId,
        navigate,
        onEndTrip,
        stopBackgroundTracking,
        stopForegroundTracking,
      ]
    );

  /* =======================================================
     MANUAL END VALIDATION

     RULES:

     1. All students must first be handled.
     2. If everybody is absent -> end immediately.
     3. Otherwise driver must be <= 500 m from
        final ride destination.
  ======================================================= */

  const handleEndTripRequest =
    () => {
      /*
       * There are still unfinished students.
       */
      if (
        !allStudentsCompleted &&
        !allAbsent
      ) {
        alert(
          `${actualRemaining} student${
            actualRemaining ===
            1
              ? ""
              : "s"
          } still need to be completed before ending the trip.`
        );

        return;
      }

      /*
       * Everyone absent:
       * No location restriction.
       */
      if (
        allAbsent
      ) {
        setShowEndPopup(
          true
        );

        return;
      }

      /*
       * There was a genuine ride, therefore
       * we need the driver's current GPS.
       */
      if (
        !driverLocation ||
        !isValidCoordinate(
          driverLocation.lat
        ) ||
        !isValidCoordinate(
          driverLocation.lng
        )
      ) {
        setEndTripDistance(
          null
        );

        setShowDistancePopup(
          true
        );

        return;
      }

      /*
       * Final destination unavailable.
       *
       * We deliberately DON'T allow ending
       * because it would bypass the safety rule.
       */
      if (
        !lastRideLocationRef.current
      ) {
        setEndTripDistance(
          null
        );

        setShowDistancePopup(
          true
        );

        return;
      }

      const distance =
        calculateDistanceMeters(
          driverLocation,
          lastRideLocationRef.current
        );

      setEndTripDistance(
        distance
      );

      /*
       * Inside 500 m.
       */
      if (
        distance <=
        END_TRIP_RADIUS_METERS
      ) {
        setShowEndPopup(
          true
        );

        return;
      }

      /*
       * Too far.
       */
      setShowDistancePopup(
        true
      );
    };

  /* =======================================================
     TRIP TIMER + 3 HOUR AUTO END

     Automatic timeout remains an emergency
     hard limit and bypasses the 500m manual
     restriction.
  ======================================================= */

  useEffect(() => {
    if (
      !tripStartTime
    ) {
      return;
    }

    let disposed =
      false;

    let autoEndTimeout =
      null;

    const startTimestamp =
      new Date(
        tripStartTime
      ).getTime();

    if (
      !Number.isFinite(
        startTimestamp
      )
    ) {
      return;
    }

    const forceEndIfExpired =
      async () => {
        if (disposed) {
          return;
        }

        const elapsedMs =
          Math.max(
            0,
            Date.now() -
              startTimestamp
          );

        if (
          elapsedMs >=
          MAX_TRIP_DURATION_MS
        ) {
          setTripDuration(
            "03:00:00"
          );

          await endTrip({
            automatic:
              true,
          });

          return;
        }

        const diff =
          Math.floor(
            elapsedMs /
              1000
          );

        const hrs =
          String(
            Math.floor(
              diff /
                3600
            )
          ).padStart(
            2,
            "0"
          );

        const mins =
          String(
            Math.floor(
              (diff %
                3600) /
                60
            )
          ).padStart(
            2,
            "0"
          );

        const secs =
          String(
            diff %
              60
          ).padStart(
            2,
            "0"
          );

        setTripDuration(
          `${hrs}:${mins}:${secs}`
        );
      };

    forceEndIfExpired();

    const interval =
      window.setInterval(
        forceEndIfExpired,
        1000
      );

    const elapsedNow =
      Math.max(
        0,
        Date.now() -
          startTimestamp
      );

    const remainingUntilLimit =
      MAX_TRIP_DURATION_MS -
      elapsedNow;

    if (
      remainingUntilLimit >
      0
    ) {
      autoEndTimeout =
        window.setTimeout(
          () => {
            forceEndIfExpired();
          },
          remainingUntilLimit +
            100
        );
    }

    const handleVisibilityChange =
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          forceEndIfExpired();
        }
      };

    const handleFocus =
      () => {
        forceEndIfExpired();
      };

    const handleOnline =
      () => {
        forceEndIfExpired();
      };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    window.addEventListener(
      "focus",
      handleFocus
    );

    window.addEventListener(
      "online",
      handleOnline
    );

    return () => {
      disposed =
        true;

      window.clearInterval(
        interval
      );

      if (
        autoEndTimeout
      ) {
        window.clearTimeout(
          autoEndTimeout
        );
      }

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      window.removeEventListener(
        "focus",
        handleFocus
      );

      window.removeEventListener(
        "online",
        handleOnline
      );
    };
  }, [
    tripStartTime,
    endTrip,
  ]);

  /* =======================================================
     POLLING
  ======================================================= */

  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          fetchStudents();

          fetchTripProgress();

          fetchActiveTrip();
        },
        300
      );

    pollingRef.current =
      window.setInterval(
        () => {
          fetchStudents();

          fetchTripProgress();
        },
        5000
      );

    return () => {
      window.clearTimeout(
        timer
      );

      if (
        pollingRef.current
      ) {
        window.clearInterval(
          pollingRef.current
        );

        pollingRef.current =
          null;
      }
    };
  }, [
    fetchStudents,
    fetchTripProgress,
    fetchActiveTrip,
  ]);

  /* =======================================================
     START GPS + MAP
  ======================================================= */

  useEffect(() => {
    startLocationTracking();

    const mapTimer =
      window.setTimeout(
        () => {
          setShowMap(
            true
          );
        },
        300
      );

    return () => {
      window.clearTimeout(
        mapTimer
      );

      stopBackgroundTracking();

      stopForegroundTracking();
    };
  }, [
    startLocationTracking,
    stopBackgroundTracking,
    stopForegroundTracking,
  ]);

  /* =======================================================
     PHASE SWITCH
  ======================================================= */

  useEffect(() => {
    if (
      !students.length
    ) {
      return;
    }

    const remainingPickup =
      students.some(
        (
          student
        ) =>
          student.status ===
          "waiting"
      );

    if (
      tripPhase ===
        "pickup" &&
      !remainingPickup &&
      !allAbsent
    ) {
      setTripPhase(
        "drop"
      );
    }
  }, [
    students,
    tripPhase,
    allAbsent,
  ]);

  useEffect(() => {
    if (
      !students.length
    ) {
      return;
    }

    const hasWaiting =
      students.some(
        (
          student
        ) =>
          student.status ===
          "waiting"
      );

    if (
      hasWaiting &&
      tripPhase !==
        "pickup"
    ) {
      setTripPhase(
        "pickup"
      );
    }
  }, [
    students,
    tripPhase,
  ]);

  /* =======================================================
     REVERSE GEOCODING
  ======================================================= */

  const reverseGeocode =
    useCallback(
      async (
        lat,
        lng
      ) => {
        if (
          !mapsLoaded ||
          !window.google
            ?.maps
            ?.Geocoder
        ) {
          return "Unknown Location";
        }

        try {
          const geocoder =
            new window.google.maps.Geocoder();

          const response =
            await geocoder.geocode({
              location: {
                lat:
                  Number(lat),

                lng:
                  Number(lng),
              },
            });

          return (
            response
              ?.results?.[0]
              ?.formatted_address ||
            "Unknown Location"
          );
        } catch (error) {
          console.error(
            "Reverse geocoding error:",
            error
          );

          return "Unknown Location";
        }
      },
      [
        mapsLoaded,
      ]
    );

  /* =======================================================
     PHOTO VERIFICATION
  ======================================================= */

  const uploadVerificationPhoto =
    async (
      photoBlob
    ) => {
      if (
        !photoBlob ||
        !selectedTrip
      ) {
        return;
      }

      /*
       * Capture student BEFORE fetching refreshed status.
       */
      const currentStudent =
        findStudentByTripId(
          selectedTrip
        );

      try {
        setIsUploading(
          true
        );

        let lat;
        let lng;

        if (
          !Capacitor.isNativePlatform()
        ) {
          const position =
            await new Promise(
              (
                resolve,
                reject
              ) => {
                navigator.geolocation.getCurrentPosition(
                  resolve,
                  reject,
                  {
                    enableHighAccuracy:
                      true,

                    timeout:
                      15000,

                    maximumAge:
                      0,
                  }
                );
              }
            );

          lat =
            position.coords.latitude;

          lng =
            position.coords.longitude;
        } else {
          const position =
            await Geolocation.getCurrentPosition(
              {
                enableHighAccuracy:
                  true,

                timeout:
                  15000,
              }
            );

          lat =
            position.coords.latitude;

          lng =
            position.coords.longitude;
        }

        const address =
          await reverseGeocode(
            lat,
            lng
          );

        const formData =
          new FormData();

        formData.append(
          "photo",
          photoBlob,
          "capture.jpg"
        );

        formData.append(
          "latitude",
          String(lat)
        );

        formData.append(
          "longitude",
          String(lng)
        );

        formData.append(
          "address",
          address
        );

        formData.append(
          "capturedAt",
          new Date().toISOString()
        );

        if (
          photoType ===
          "morning"
        ) {
          /*
           * Morning DROP is a completed ride.
           */
          if (
            currentStudent
          ) {
            rememberFinalRideLocation(
              currentStudent
            );
          }

          await uploadMorningDropPhoto(
            selectedTrip,
            formData
          );

          await axios.post(
            `/trip/drop/${selectedTrip}`
          );
        } else {
          await uploadAfternoonPickupPhoto(
            selectedTrip,
            formData
          );

          await axios.post(
            `/trip/pickup/${selectedTrip}`
          );
        }

        setShowPhotoModal(
          false
        );

        setSelectedTrip(
          null
        );

        setPhotoType("");

        await fetchStudents();

        await fetchTripProgress();

        setDirections(
          null
        );

        lastRouteDestination.current =
          null;

        setNextStudent(
          null
        );
      } catch (error) {
        console.error(
          "Upload error:",
          error
        );

        alert(
          error.response
            ?.data
            ?.message ||
            "Failed to upload verification photo"
        );
      } finally {
        setIsUploading(
          false
        );
      }
    };

  /* =======================================================
     PICKUP
  ======================================================= */

  const handlePickup =
    async (
      tripId
    ) => {
      if (
        isEveningTrip()
      ) {
        setSelectedTrip(
          tripId
        );

        setPhotoType(
          "afternoon"
        );

        setShowPhotoModal(
          true
        );

        return;
      }

      try {
        await axios.post(
          `/trip/pickup/${tripId}`
        );

        await fetchStudents();

        await fetchTripProgress();

        window.setTimeout(
          () => {
            fetchStudents();

            fetchTripProgress();
          },
          1000
        );

        setDirections(
          null
        );

        setNextStudent(
          null
        );
      } catch (error) {
        console.error(
          error
        );

        alert(
          error.response
            ?.data
            ?.message ||
            "Failed to pickup student"
        );
      }
    };

  /* =======================================================
     DROP
  ======================================================= */

  const handleDrop =
    async (
      tripId
    ) => {
      if (processingTripId) {
        return;
      }

      /*
       * Remember destination BEFORE
       * student gets marked dropped.
       */
      const currentStudent =
        findStudentByTripId(
          tripId
        );

      if (
        currentStudent
      ) {
        rememberFinalRideLocation(
          currentStudent
        );
      }

      /*
       * Evening drop doesn't require photo.
       */
      if (
        isEveningTrip()
      ) {
        setProcessingTripId(
          tripId
        );

        try {
          await axios.post(
            `/trip/drop/${tripId}`
          );

          await fetchStudents();

          await fetchTripProgress();

          setDirections(
            null
          );

          lastRouteDestination.current =
            null;

          setNextStudent(
            null
          );
        } catch (error) {
          console.error(
            error
          );

          alert(
            error.response
              ?.data
              ?.message ||
            "Failed to drop student"
          );
        } finally {
          setProcessingTripId(
            null
          );
        }

        return;
      }

      /*
       * Morning drop requires verification.
       */
      setSelectedTrip(
        tripId
      );

      setPhotoType(
        "morning"
      );

      setShowPhotoModal(
        true
      );
    };

  /* =======================================================
     ABSENT
  ======================================================= */

  const handleAbsent =
    async (
      id
    ) => {
      try {
        await axios.post(
          "/children/absent",
          {
            childId:
              id,
          }
        );

        await fetchStudents();

        await fetchTripProgress();

        setDirections(
          null
        );

        setNextStudent(
          null
        );
      } catch (error) {
        console.error(
          error
        );

        alert(
          error.response
            ?.data
            ?.message ||
            "Failed to mark student absent"
        );
      }
    };

  /* =======================================================
     END BUTTON LABEL
  ======================================================= */

  const getEndButtonLabel =
    () => {
      if (
        isUploading
      ) {
        return "UPLOADING VERIFICATION...";
      }

      if (
        allAbsent
      ) {
        return "END CURRENT TRIP";
      }

      if (
        !allStudentsCompleted
      ) {
        return `${actualRemaining} STUDENT${
          actualRemaining ===
          1
            ? ""
            : "S"
        } REMAINING`;
      }

      if (
        insideEndRadius
      ) {
        return "END CURRENT TRIP";
      }

      return "END CURRENT TRIP";
    };

  /* =======================================================
     UI
  ======================================================= */

  return (
    <div className="min-h-screen bg-[#FFF9EE] flex justify-center">

      <div className="relative min-h-screen w-full max-w-[475px] overflow-hidden bg-[#FFF9EE]">

        {/* =================================================
            MAP
        ================================================= */}

        <section className="relative h-[36vh] min-h-[270px] max-h-[340px] w-full overflow-hidden bg-[#EEE8DD]">

          {!GOOGLE_KEY ? (
            <MapLoadingState
              title="Google Maps key missing"
              message="VITE_GOOGLE_MAPS_API_KEY is not configured."
              error
            />
          ) : mapsLoadError ? (
            <MapLoadingState
              title="Unable to load map"
              message="Check Maps JavaScript API, billing and API key restrictions."
              error
            />
          ) : !mapsLoaded ||
            !showMap ? (
            <MapLoadingState
              title="Loading live route..."
              message="Getting GPS and route information."
              loading
            />
          ) : (
            <GoogleMap
              mapContainerStyle={
                containerStyle
              }
              center={
                safeDriverLocation ||
                DEFAULT_MAP_CENTER
              }
              zoom={15}
              onLoad={(
                map
              ) => {
                mapRef.current =
                  map;

                // Start north-up; live GPS updates rotate this map beneath the arrow.
                map.setHeading(0);
                map.setTilt(45);
              }}
              onUnmount={() => {
                mapRef.current =
                  null;
              }}
              options={{
                disableDefaultUI:
                  true,

                zoomControl:
                  false,

                streetViewControl:
                  false,

                mapTypeControl:
                  false,

                fullscreenControl:
                  false,

                rotateControl:
                  true,

                tilt:
                  45,

                clickableIcons:
                  false,

                gestureHandling:
                  "greedy",
              }}
            >

              {animatedDriverLocation && (
                <OverlayView
                  position={
                    animatedDriverLocation
                  }
                  mapPaneName={
                    OverlayView.OVERLAY_MOUSE_TARGET
                  }
                >
                  <div
                    aria-label="Driver's current location"
                    className="pointer-events-none"
                    style={{
                      width:
                        "42px",

                      height:
                        "42px",

                      transform:
                        "translate(-50%, -50%)",

                      transformOrigin:
                        "center",

                      transition:
                        "transform 220ms linear",

                      filter:
                        "drop-shadow(0 3px 5px rgba(0, 0, 0, 0.28))",
                    }}
                  >
                    <img
                      src={
                        driverNavigationPointer
                      }
                      alt=""
                      draggable="false"
                      className="h-full w-full select-none object-contain"
                    />
                  </div>
                </OverlayView>
              )}

              {students.map(
                (
                  student
                ) => {
                  const coords =
                    getCoords(
                      student
                    );

                  if (
                    !coords
                  ) {
                    return null;
                  }

                  const lat =
                    Number(
                      coords.lat
                    );

                  const lng =
                    Number(
                      coords.lng
                    );

                  if (
                    !Number.isFinite(
                      lat
                    ) ||
                    !Number.isFinite(
                      lng
                    )
                  ) {
                    return null;
                  }

                  const icon =
                    studentIcons[
                      student.status
                    ] ||
                    studentIcons.default;

                  return (
                    <Marker
                      key={
                        student._id
                      }
                      position={{
                        lat,
                        lng,
                      }}
                      icon={
                        icon ||
                        undefined
                      }
                      label={{
                        text:
                          student.name
                            ?.charAt(
                              0
                            ) ||
                          "?",

                        color:
                          "#FFFFFF",

                        fontSize:
                          "10px",

                        fontWeight:
                          "bold",
                      }}
                    />
                  );
                }
              )}

              {directions && (
                <DirectionsRenderer
                  directions={
                    directions
                  }
                  options={{
                    suppressMarkers:
                      true,
                  }}
                />
              )}

            </GoogleMap>
          )}

          {/* LIVE */}

          <div className="absolute left-4 right-4 top-4 z-10">

            <div className="flex items-center justify-between">

              <div className="flex items-center gap-2 rounded-full border border-white/80 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">

                <span className="relative flex h-2 w-2">

                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4E854A] opacity-50" />

                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#4E854A]" />

                </span>

                <span className="text-[7px] font-black tracking-[0.12em] text-black">
                  LIVE TRIP
                </span>

              </div>

              <div className="rounded-full border border-white/80 bg-white/95 px-3 py-2 shadow-sm backdrop-blur">

                <span className="text-[7px] font-black text-[#A97000]">

                  {allAbsent
                    ? "ALL ABSENT"
                    : tripPhase ===
                      "pickup"
                    ? "PICKUP PHASE"
                    : "DROP PHASE"}

                </span>

              </div>

            </div>

          </div>

          {/* NEXT STOP */}

          <div className="absolute bottom-4 left-4 right-4 z-10">

            <div className="flex items-center justify-between rounded-[16px] border border-white/80 bg-white/95 px-3.5 py-3 shadow-[0_8px_25px_rgba(30,20,10,0.12)] backdrop-blur">

              <div className="flex min-w-0 items-center gap-2.5">

                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#FFF0C5]">

                  <Navigation
                    size={15}
                    className="text-[#A97000]"
                  />

                </div>

                <div className="min-w-0">

                  <p className="text-[6px] font-black tracking-[0.12em] text-[#9A9084]">
                    NEXT STOP
                  </p>

                  <p className="mt-0.5 truncate text-[9px] font-black text-black">

                    {allAbsent
                      ? "No ride required"
                      : nextStudent
                      ?.name ||
                        (allStudentsCompleted
                          ? "Trip route completed"
                          : "Calculating route...")}

                  </p>

                </div>

              </div>

              <div className="text-right">

                <p className="text-[6px] font-bold text-[#9A9084]">
                  ETA
                </p>

                <p className="mt-0.5 text-[11px] font-black text-[#A97000]">
                  {allAbsent
                    ? "--"
                    : eta}
                </p>

              </div>

            </div>

          </div>

        </section>

        {/* =================================================
            CONTENT
        ================================================= */}

        <main className="relative z-10 px-4 pb-8 pt-4">

          <div className="px-1">

            <div className="flex items-center gap-2">

              <Route
                size={12}
                className="text-[#B87700]"
              />

              <p className="text-[8px] font-black tracking-[0.15em] text-[#B87700]">
                ACTIVE DUTY
              </p>

            </div>

            <div className="mt-1 flex items-end justify-between">

              <h1 className="text-[20px] font-black text-black">
                Trip in Progress
              </h1>

              <div className="flex items-center gap-1">

                <Timer
                  size={10}
                  className="text-[#91877C]"
                />

                <span className="text-[8px] font-black text-[#70675F]">
                  {tripDuration}
                </span>

              </div>

            </div>

          </div>

          {/* NEXT STUDENT */}

          <div className="mt-3">

            <NextStudentCard
              nextStudent={
                nextStudent
              }
              eta={
                eta
              }
              tripPhase={
                tripPhase
              }
              allAbsent={
                allAbsent
              }
              completed={
                allStudentsCompleted
              }
            />

          </div>

          {/* PROGRESS */}

          <div className="mt-3">

            <TripProgress
              total={
                total
              }
              picked={
                picked
              }
              dropped={
                dropped
              }
              remaining={
                awaitingPickup
              }
              progress={
                progress
              }
            />

          </div>

          {/* FINAL LOCATION STATUS */}

          {allStudentsCompleted &&
            !allAbsent && (
              <div className="mt-3">

                <FinalLocationStatus
                  distance={
                    distanceToFinalLocation
                  }
                  insideRadius={
                    insideEndRadius
                  }
                />

              </div>
            )}

          {allAbsent && (
            <div className="mt-3 rounded-[16px] border border-[#DDEBD8] bg-[#F5FBF2] p-3">

              <div className="flex items-start gap-2.5">

                <CheckCircle2
                  size={16}
                  className="mt-0.5 shrink-0 text-[#4E854A]"
                />

                <div>

                  <p className="text-[9px] font-black text-[#3F713B]">
                    All students are absent
                  </p>

                  <p className="mt-1 text-[7px] leading-[1.5] text-[#668062]">
                    No final destination check is required. You can end the trip now.
                  </p>

                </div>

              </div>

            </div>
          )}

          {/* SUMMARY */}

          <div className="mt-3">

            <TripSummary
              tripDuration={
                tripDuration
              }
              tripPhase={
                tripPhase
              }
            />

          </div>

          {/* STUDENTS TITLE */}

          <div className="mb-3 mt-5 flex items-end justify-between px-1">

            <div>

              <p className="text-[8px] font-black tracking-[0.15em] text-[#B87700]">
                STUDENTS
              </p>

              <h2 className="mt-1 text-[17px] font-black text-black">
                Trip List
              </h2>

            </div>

            <p className="text-[7px] font-bold text-[#91877C]">
              {students.length} TOTAL
            </p>

          </div>

          {/* EMPTY */}

          {students.length ===
            0 && (
            <div className="rounded-[18px] border border-[#EEE3D1] bg-white py-9 text-center">

              <Users
                size={20}
                className="mx-auto text-[#A97000]"
              />

              <p className="mt-2 text-[10px] font-black text-black">
                No students available
              </p>

            </div>
          )}

          {/* STUDENTS */}

          <div className="space-y-2.5">

            {visibleStudents.map(
              (
                student
              ) => (
                <StudentCard
                  key={
                    student._id
                  }
                  student={
                    student
                  }
                  tripPhase={
                    tripPhase
                  }
                  isEvening={
                    isEveningTrip
                  }
                  onPickup={
                    handlePickup
                  }
                  onDrop={
                    handleDrop
                  }
                  onAbsent={
                    handleAbsent
                  }
                  isUploading={
                    isUploading ||
                    Boolean(processingTripId)
                  }
                />
              )
            )}

          </div>

          {/* VIEW ALL */}

          {hasMoreStudents && (
            <button
              type="button"
              onClick={() =>
                setShowAllStudents(
                  (
                    previous
                  ) =>
                    !previous
                )
              }
              className="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-[12px] border border-[#EEE3D1] bg-white text-[7px] font-black text-[#776E65]"
            >

              {showAllStudents ? (
                <>
                  <ChevronUp
                    size={13}
                  />

                  SHOW LESS
                </>
              ) : (
                <>
                  <ChevronDown
                    size={13}
                  />

                  VIEW ALL{" "}
                  {students.length}{" "}
                  STUDENTS
                </>
              )}

            </button>
          )}

          {/* =================================================
              END TRIP BUTTON

              It remains disabled while students are
              genuinely unfinished.

              Once all students are finished it becomes
              clickable.

              The click then performs the 500 m check.
          ================================================= */}

          <button
            type="button"
            disabled={
              isUploading ||
              endingTrip ||
              (
                !allStudentsCompleted &&
                !allAbsent
              )
            }
            onClick={
              handleEndTripRequest
            }
            className={`mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-[15px] text-[8px] font-black transition ${
              isUploading ||
              endingTrip ||
              (
                !allStudentsCompleted &&
                !allAbsent
              )
                ? "cursor-not-allowed bg-[#E4DED5] text-[#968C82]"
                : allAbsent ||
                  insideEndRadius
                ? "bg-black text-white active:scale-[0.99]"
                : "border border-[#E2B856] bg-[#FFF2C6] text-[#8B6200] active:scale-[0.99]"
            }`}
          >

            {endingTrip ? (
              <Loader2
                size={14}
                className="animate-spin"
              />
            ) : (
              <Flag
                size={14}
              />
            )}

            {endingTrip
              ? "ENDING TRIP..."
              : getEndButtonLabel()}

          </button>

          {!allStudentsCompleted &&
            !allAbsent && (
              <p className="mt-2 text-center text-[6.5px] font-semibold text-[#9A9084]">
                Complete all remaining student rides before ending the trip.
              </p>
            )}

          {allStudentsCompleted &&
            !allAbsent &&
            !insideEndRadius && (
              <p className="mt-2 text-center text-[6.5px] font-semibold text-[#A97000]">
                Reach within 500 m of the final ride location before ending the trip.
              </p>
            )}

          {allStudentsCompleted &&
            !allAbsent &&
            insideEndRadius && (
              <p className="mt-2 text-center text-[6.5px] font-semibold text-[#4E854A]">
                Final destination reached. Trip can now be ended.
              </p>
            )}

          {allAbsent && (
            <p className="mt-2 text-center text-[6.5px] font-semibold text-[#4E854A]">
              All students are absent. Trip can be ended immediately.
            </p>
          )}

          <p className="mt-1 text-center text-[6px] text-[#A59A8D]">
            Trips also automatically end after a maximum of 3 hours.
          </p>

        </main>

        {/* =================================================
            DISTANCE WARNING POPUP
        ================================================= */}

        {showDistancePopup && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 px-5 backdrop-blur-[2px]">

            <div className="w-full max-w-[350px] rounded-[22px] border border-[#EEE3D1] bg-white p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">

              <div className="flex items-start justify-between">

                <div className="flex h-12 w-12 items-center justify-center rounded-[15px] bg-[#FFF0C5]">

                  <LocateFixed
                    size={20}
                    className="text-[#A97000]"
                  />

                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowDistancePopup(
                      false
                    )
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#F5F1EA]"
                >

                  <X
                    size={15}
                  />

                </button>

              </div>

              <h2 className="mt-4 text-[16px] font-black text-black">
                Final Location Not Reached
              </h2>

              {!driverLocation ? (
                <p className="mt-2 text-[8px] leading-[1.65] text-[#83796E]">
                  Your current GPS location is unavailable. Enable location permission and wait for GPS before ending the trip.
                </p>
              ) : !lastRideLocationRef.current ? (
                <p className="mt-2 text-[8px] leading-[1.65] text-[#83796E]">
                  The final ride location could not be verified yet. Please wait for trip information to refresh and try again.
                </p>
              ) : (
                <>
                  <p className="mt-2 text-[8px] leading-[1.65] text-[#83796E]">
                    You must reach within{" "}
                    <span className="font-black text-black">
                      500 metres
                    </span>{" "}
                    of the final student's ride location before ending this trip.
                  </p>

                  <div className="mt-4 rounded-[14px] border border-[#EEE3D1] bg-[#FFF9EE] p-3">

                    <p className="text-[6px] font-black tracking-[0.12em] text-[#9A9084]">
                      CURRENT DISTANCE
                    </p>

                    <p className="mt-1 text-[18px] font-black text-[#A97000]">
                      {formatDistance(
                        endTripDistance
                      )}
                    </p>

                    <p className="mt-1 text-[7px] text-[#83796E]">
                      Required: 500 m or less
                    </p>

                  </div>
                </>
              )}

              <button
                type="button"
                onClick={() =>
                  setShowDistancePopup(
                    false
                  )
                }
                className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-[13px] bg-[#FFB000] text-[8px] font-black text-black"
              >

                <Navigation
                  size={13}
                />

                CONTINUE TO FINAL LOCATION

              </button>

            </div>

          </div>
        )}

        {/* =================================================
            END CONFIRM
        ================================================= */}

        {showEndPopup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-5 backdrop-blur-[2px]">

            <div className="w-full max-w-[350px] rounded-[22px] border border-[#EEE3D1] bg-white p-5">

              <div className="flex items-start justify-between">

                <div className="flex h-12 w-12 items-center justify-center rounded-[15px] bg-[#FBE7E4]">

                  <AlertTriangle
                    size={20}
                    className="text-[#B85149]"
                  />

                </div>

                <button
                  type="button"
                  disabled={
                    endingTrip
                  }
                  onClick={() =>
                    setShowEndPopup(
                      false
                    )
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#F5F1EA] disabled:opacity-50"
                >

                  <X
                    size={15}
                  />

                </button>

              </div>

              <h2 className="mt-4 text-[16px] font-black text-black">
                End Current Trip?
              </h2>

              {allAbsent ? (
                <p className="mt-2 text-[8px] leading-[1.65] text-[#83796E]">
                  All students were marked absent. No destination verification is required. The trip can be closed now.
                </p>
              ) : (
                <p className="mt-2 text-[8px] leading-[1.65] text-[#83796E]">
                  The final ride location has been reached. Live tracking will stop and this duty will be added to trip history.
                </p>
              )}

              <div className="mt-5 grid grid-cols-2 gap-2.5">

                <button
                  type="button"
                  disabled={
                    endingTrip
                  }
                  onClick={() =>
                    setShowEndPopup(
                      false
                    )
                  }
                  className="h-11 rounded-[13px] border border-[#EEE3D1] bg-[#FFF9EE] text-[8px] font-black disabled:opacity-50"
                >
                  CANCEL
                </button>

                <button
                  type="button"
                  disabled={
                    endingTrip
                  }
                  onClick={() =>
                    endTrip({
                      automatic:
                        false,
                    })
                  }
                  className="flex h-11 items-center justify-center gap-2 rounded-[13px] bg-black text-[8px] font-black text-white disabled:opacity-60"
                >

                  {endingTrip && (
                    <Loader2
                      size={13}
                      className="animate-spin"
                    />
                  )}

                  {endingTrip
                    ? "ENDING..."
                    : "END TRIP"}

                </button>

              </div>

            </div>

          </div>
        )}

        {/* =================================================
            CAMERA CAPTURE
        ================================================= */}

        {showPhotoModal && (
          <CameraCapture
            onCancel={() => {
              setShowPhotoModal(
                false
              );

              setSelectedTrip(
                null
              );

              setPhotoType(
                ""
              );
            }}
            onCapture={async (
              blob
            ) => {
              await uploadVerificationPhoto(
                blob
              );
            }}
          />
        )}

      </div>

    </div>
  );
}

/* =========================================================
   MAP LOADING STATE
========================================================= */

function MapLoadingState({
  title,
  message,
  loading = false,
  error = false,
}) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#EFE9DE] px-6">

      <div className="text-center">

        {loading ? (
          <Loader2
            size={30}
            className="mx-auto animate-spin text-[#A97000]"
          />
        ) : error ? (
          <AlertTriangle
            size={28}
            className="mx-auto text-[#B85149]"
          />
        ) : (
          <MapPin
            size={28}
            className="mx-auto text-[#A97000]"
          />
        )}

        <p className="mt-3 text-[9px] font-black text-black">
          {title}
        </p>

        {message && (
          <p className="mx-auto mt-1.5 max-w-[240px] text-[7px] leading-[1.5] text-[#8A8177]">
            {message}
          </p>
        )}

      </div>

    </div>
  );
}

/* =========================================================
   FINAL LOCATION STATUS
========================================================= */

function FinalLocationStatus({
  distance,
  insideRadius,
}) {
  return (
    <section
      className={`rounded-[16px] border p-3 ${
        insideRadius
          ? "border-[#DCEAD8] bg-[#F5FBF3]"
          : "border-[#EFD994] bg-[#FFF9EA]"
      }`}
    >

      <div className="flex items-start gap-3">

        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] ${
            insideRadius
              ? "bg-[#E7F4E3]"
              : "bg-[#FFF0C5]"
          }`}
        >

          {insideRadius ? (
            <CheckCircle2
              size={15}
              className="text-[#4E854A]"
            />
          ) : (
            <Navigation
              size={15}
              className="text-[#A97000]"
            />
          )}

        </div>

        <div className="min-w-0 flex-1">

          <p
            className={`text-[8px] font-black ${
              insideRadius
                ? "text-[#4E854A]"
                : "text-[#A97000]"
            }`}
          >
            {insideRadius
              ? "FINAL LOCATION REACHED"
              : "REACH FINAL LOCATION"}
          </p>

          <p className="mt-1 text-[7px] leading-[1.5] text-[#81776D]">

            {insideRadius
              ? "You are within 500 m of the final ride destination."
              : Number.isFinite(
                  distance
                )
              ? `You are currently ${formatDistance(
                  distance
                )} from the final ride destination.`
              : "Waiting for current GPS and final destination information."}

          </p>

        </div>

        {Number.isFinite(
          distance
        ) && (
          <span
            className={`shrink-0 rounded-full px-2 py-1 text-[6px] font-black ${
              insideRadius
                ? "bg-[#E7F4E3] text-[#4E854A]"
                : "bg-[#FFF0C5] text-[#936200]"
            }`}
          >
            {formatDistance(
              distance
            )}
          </span>
        )}

      </div>

    </section>
  );
}

/* =========================================================
   NEXT STUDENT CARD
========================================================= */

function NextStudentCard({
  nextStudent,
  eta,
  tripPhase,
  allAbsent,
  completed,
}) {
  return (
    <section className="rounded-[18px] border border-[#EEE3D1] bg-white p-4">

      <div className="flex items-start gap-3">

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#FFF0C5]">

          <Navigation
            size={17}
            className="text-[#A97000]"
          />

        </div>

        <div className="min-w-0 flex-1">

          <div className="flex items-start justify-between gap-2">

            <div className="min-w-0">

              <p className="text-[7px] font-black tracking-[0.13em] text-[#A0968A]">
                {completed
                  ? "ROUTE STATUS"
                  : "NEXT STUDENT"}
              </p>

              <h2 className="mt-1 truncate text-[13px] font-black text-black">

                {allAbsent
                  ? "No ride required"
                  : completed
                  ? "Student rides completed"
                  : nextStudent
                  ?.name ||
                    "Finding next student..."}

              </h2>

            </div>

            <span className="shrink-0 rounded-full bg-[#FFF0C5] px-2.5 py-1 text-[6px] font-black text-[#936200]">

              {allAbsent
                ? "ABSENT"
                : completed
                ? "DONE"
                : tripPhase ===
                  "pickup"
                ? "PICKUP"
                : "DROP"}

            </span>

          </div>

          <div className="mt-2 flex items-center justify-between">

            <div className="flex items-center gap-1.5">

              <Clock3
                size={11}
                className="text-[#A97000]"
              />

              <span className="text-[7px] text-[#81776D]">
                {completed
                  ? "Route completion"
                  : "Estimated arrival"}
              </span>

            </div>

            <span className="text-[11px] font-black text-[#A97000]">

              {allAbsent ||
              completed
                ? "--"
                : eta}

            </span>

          </div>

        </div>

      </div>

    </section>
  );
}

/* =========================================================
   TRIP PROGRESS
========================================================= */

function TripProgress({
  total,
  picked,
  dropped,
  remaining,
  progress,
}) {
  return (
    <section className="rounded-[18px] border border-[#EEE3D1] bg-white p-4">

      <div className="flex items-center justify-between">

        <div>

          <p className="text-[7px] font-black tracking-[0.13em] text-[#A0968A]">
            TRIP PROGRESS
          </p>

          <h3 className="mt-1 text-[12px] font-black text-black">
            Student Completion
          </h3>

        </div>

        <span className="text-[16px] font-black text-[#A97000]">
          {Math.round(
            progress
          )}
          %
        </span>

      </div>

      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#F1ECE4]">

        <div
          className="h-full rounded-full bg-[#FFB000] transition-all"
          style={{
            width:
              `${Math.min(
                progress,
                100
              )}%`,
          }}
        />

      </div>

      <div className="mt-4 grid grid-cols-4 gap-1.5">

        <ProgressStat
          label="Total"
          value={total}
        />

        <ProgressStat
          label="Picked"
          value={picked}
        />

        <ProgressStat
          label="Dropped"
          value={dropped}
        />

        <ProgressStat
          label="Remaining"
          value={remaining}
        />

      </div>

    </section>
  );
}

/* =========================================================
   PROGRESS STAT
========================================================= */

function ProgressStat({
  label,
  value,
}) {
  return (
    <div className="rounded-[11px] bg-[#FFF9EE] px-2 py-2.5 text-center">

      <p className="text-[12px] font-black text-black">
        {value}
      </p>

      <p className="mt-0.5 text-[5.5px] font-bold uppercase text-[#91877C]">
        {label}
      </p>

    </div>
  );
}

/* =========================================================
   TRIP SUMMARY
========================================================= */

function TripSummary({
  tripDuration,
  tripPhase,
}) {
  return (
    <section className="grid grid-cols-2 gap-2.5">

      <div className="rounded-[16px] border border-[#EEE3D1] bg-white p-3">

        <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#FFF0C5]">

          <Clock3
            size={13}
            className="text-[#A97000]"
          />

        </div>

        <p className="mt-2 text-[6.5px] font-bold text-[#91877C]">
          TRIP DURATION
        </p>

        <p className="mt-1 text-[11px] font-black">
          {tripDuration}
        </p>

      </div>

      <div className="rounded-[16px] border border-[#EEE3D1] bg-white p-3">

        <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#FFF0C5]">

          <Route
            size={13}
            className="text-[#A97000]"
          />

        </div>

        <p className="mt-2 text-[6.5px] font-bold text-[#91877C]">
          CURRENT PHASE
        </p>

        <p className="mt-1 text-[11px] font-black capitalize">
          {tripPhase}
        </p>

      </div>

    </section>
  );
}

/* =========================================================
   STUDENT CARD
========================================================= */

function StudentCard({
  student,
  tripPhase,
  isEvening,
  onPickup,
  onDrop,
  onAbsent,
  isUploading,
}) {
  const done =
    student.status ===
      "dropped" ||
    student.status ===
      "absent";

  const location =
    tripPhase ===
    "pickup"
      ? isEvening()
        ? student.dropoffLocation
        : student.pickupLocation
      : isEvening()
      ? student.pickupLocation
      : student.dropoffLocation;

  const getStatus =
    () => {
      switch (
        student.status
      ) {
        case "waiting":
          return {
            label:
              "WAITING",

            className:
              "bg-[#FFF0C5] text-[#936200]",

            icon:
              CircleDot,
          };

        case "picked_up":
        case "onboard":
          return {
            label:
              "ON BOARD",

            className:
              "bg-[#EDF6EB] text-[#4E854A]",

            icon:
              UserCheck,
          };

        case "dropped":
          return {
            label:
              "DROPPED",

            className:
              "bg-[#EEEAFB] text-[#7564A8]",

            icon:
              CheckCircle2,
          };

        case "absent":
          return {
            label:
              "ABSENT",

            className:
              "bg-[#FBE7E4] text-[#B85149]",

            icon:
              UserX,
          };

        default:
          return {
            label:
              String(
                student.status ||
                  "WAITING"
              )
                .replace(
                  "_",
                  " "
                )
                .toUpperCase(),

            className:
              "bg-[#F2EEE7] text-[#756D64]",

            icon:
              CircleDot,
          };
      }
    };

  const status =
    getStatus();

  const StatusIcon =
    status.icon;

  return (
    <section className="rounded-[18px] border border-[#EEE3D1] bg-white p-4">

      <div className="flex items-start gap-3">

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[#FFF0C5]">

          <span className="text-[10px] font-black text-[#A97000]">

            {String(
              student.name ||
                "ST"
            )
              .split(" ")
              .filter(Boolean)
              .map(
                (
                  item
                ) =>
                  item[0]
              )
              .join("")
              .slice(
                0,
                2
              )
              .toUpperCase()}

          </span>

        </div>

        <div className="min-w-0 flex-1">

          <div className="flex items-start justify-between gap-2">

            <div className="min-w-0">

              <h3 className="truncate text-[11px] font-black">
                {student.name ||
                  "Student"}
              </h3>

              <div className="mt-1 flex items-start gap-1">

                <MapPin
                  size={10}
                  className="mt-0.5 shrink-0 text-[#A97000]"
                />

                <p className="line-clamp-2 text-[7px] leading-[1.45] text-[#91877C]">
                  {location ||
                    "Location unavailable"}
                </p>

              </div>

            </div>

            <span
              className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[5.5px] font-black ${status.className}`}
            >

              <StatusIcon
                size={8}
              />

              {status.label}

            </span>

          </div>

        </div>

      </div>

      {(student.pickupTime ||
        student.dropoffTime ||
        student.actualPickupTime ||
        student.actualDropTime) && (
          <div className="mt-3 grid grid-cols-2 gap-2">

            <TimeBlock
              label="Pickup"
              value={
                formatRecordedTime(
                  student.actualPickupTime
                )
              }
            />

            <TimeBlock
              label="Drop"
              value={
                formatRecordedTime(
                  student.actualDropTime
                )
              }
            />

          </div>
        )}

      {!done && (
        <div className="mt-3">

          {student.status ===
            "waiting" &&
            tripPhase ===
              "pickup" && (
              <div className="grid grid-cols-2 gap-2">

                <button
                  type="button"
                  disabled={
                    isUploading
                  }
                  onClick={() =>
                    onPickup(
                      student.tripId
                    )
                  }
                  className="flex h-10 items-center justify-center gap-1.5 rounded-[12px] bg-[#FFB000] text-[7px] font-black disabled:opacity-50"
                >

                  <UserCheck
                    size={12}
                  />

                  PICK UP

                </button>

                <button
                  type="button"
                  disabled={
                    isUploading
                  }
                  onClick={() =>
                    onAbsent(
                      student._id
                    )
                  }
                  className="flex h-10 items-center justify-center gap-1.5 rounded-[12px] border border-[#EEE3D1] bg-[#FFF9EE] text-[7px] font-black disabled:opacity-50"
                >

                  <UserX
                    size={12}
                  />

                  ABSENT

                </button>

              </div>
            )}

          {(student.status ===
            "onboard" ||
            student.status ===
              "picked_up") &&
            tripPhase ===
              "drop" && (
              <button
                type="button"
                disabled={
                  isUploading
                }
                onClick={() =>
                  onDrop(
                    student.tripId
                  )
                }
                className="flex h-10 w-full items-center justify-center gap-1.5 rounded-[12px] bg-[#FFB000] text-[7px] font-black disabled:opacity-50"
              >

                <CheckCircle2
                  size={12}
                />

                {isUploading
                  ? "UPLOADING..."
                  : "DROP OFF"}

              </button>
            )}

        </div>
      )}

    </section>
  );
}

/* =========================================================
   TIME BLOCK
========================================================= */

function TimeBlock({
  label,
  value,
}) {
  return (
    <div className="rounded-[11px] bg-[#FFF9EE] px-3 py-2">

      <p className="text-[5.5px] font-bold uppercase text-[#91877C]">
        {label}
      </p>

      <p className="mt-0.5 text-[7.5px] font-black">
        {value}
      </p>

    </div>
  );
}

export default ActiveTripScreen;
