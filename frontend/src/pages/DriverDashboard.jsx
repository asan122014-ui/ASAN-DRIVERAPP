import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";

import {
  motion,
  useMotionValue,
  animate,
  useTransform,
} from "framer-motion";

import { useNavigate } from "react-router-dom";
import axios from "../utils/axiosInstance";
import { io } from "socket.io-client";

import {
  Flag,
  MapPin,
  Bell,
  Sun,
  CloudSun,
  Users,
  Home,
  User,
  Clock,
  Play,
  CheckCircle2,
  Navigation,
} from "lucide-react";

import ActiveTripScreen from "./ActiveTripScreen";

/* =========================================================
   SOCKET SERVER
========================================================= */

const SOCKET_URL =
  "https://asan-driverapp.onrender.com";

/* =========================================================
   DRIVER DASHBOARD
========================================================= */

function DriverDashboard() {
  const navigate = useNavigate();

  /* =======================================================
     STATES
  ======================================================= */

  const [driverData, setDriverData] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [tripStarted, setTripStarted] =
    useState(false);

  const [unreadCount, setUnreadCount] =
    useState(0);

  const [bookingOffers, setBookingOffers] = useState([]);
  const [activeBookingOfferId, setActiveBookingOfferId] = useState(null);
  const [bookingOfferBusy, setBookingOfferBusy] = useState("");
  const [bookingOfferError, setBookingOfferError] = useState("");
  const [bookingOfferNotice, setBookingOfferNotice] = useState("");
  const [bookingOffersLoading, setBookingOffersLoading] = useState(false);

  const [
    morningCompleted,
    setMorningCompleted,
  ] = useState(false);

  const [
    afternoonCompleted,
    setAfternoonCompleted,
  ] = useState(false);

  const [
    selectedTrip,
    setSelectedTrip,
  ] = useState("morning");

  const [
    currentHour,
    setCurrentHour,
  ] = useState(
    new Date().getHours()
  );

  const [
    videoDevices,
    setVideoDevices,
  ] = useState([]);

  const [
    showCameraSelect,
    setShowCameraSelect,
  ] = useState(false);

  /* =======================================================
     DRIVER
  ======================================================= */

  const driver =
    useMemo(() => {
      try {
        const data =
          localStorage.getItem(
            "driver"
          );

        return data
          ? JSON.parse(data)
          : null;
      } catch (error) {
        console.error(
          "Invalid Driver session:",
          error
        );

        localStorage.removeItem(
          "driver"
        );

        return null;
      }
    }, []);

  /* =======================================================
     REFS
  ======================================================= */

  const sliderRef =
    useRef(null);

  const videoRef =
    useRef(null);

  const socketRef =
    useRef(null);

  const streamRef =
    useRef(null);

  const knownBookingOfferIdsRef = useRef(new Set());
  const socketBookingOffersRef = useRef(new Map());

  const peersRef =
    useRef({});

  const iceCandidateQueueRef =
    useRef({});

  const refreshBookingOffers = useCallback(async ({ manual = false } = {}) => {
    if (!driver?.driverId || !localStorage.getItem("accessToken")) {
      setBookingOfferError("Your driver session is missing. Sign in again to check ride requests.");
      return;
    }
    if (manual) setBookingOffersLoading(true);
    try {
      const response = await axios.get("/driver-request/offers");
      const offers = Array.isArray(response.data?.data) ? response.data.data : [];
      const now = Date.now();
      for (const [requestId, offer] of socketBookingOffersRef.current) {
        if (offer.expiresAt && new Date(offer.expiresAt).getTime() <= now) socketBookingOffersRef.current.delete(requestId);
      }
      const mergedOffers = new Map([...socketBookingOffersRef.current.values()].map((offer) => [offer.requestId, offer]));
      offers.forEach((offer) => mergedOffers.set(offer.requestId, offer));
      const visibleOffers = [...mergedOffers.values()].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      const incomingOffer = offers.find((offer) => !knownBookingOfferIdsRef.current.has(offer.requestId));
      offers.forEach((offer) => knownBookingOfferIdsRef.current.add(offer.requestId));
      if (manual && visibleOffers.length) setActiveBookingOfferId(visibleOffers[0].requestId);
      else if (incomingOffer) setActiveBookingOfferId((currentId) => currentId || incomingOffer.requestId);
      setBookingOffers(visibleOffers);
      setBookingOfferError("");
      if (manual) {
        setBookingOfferNotice(visibleOffers.length
          ? `You have ${visibleOffers.length} ride request${visibleOffers.length === 1 ? "" : "s"} waiting for ${driver?.driverId || "this driver"}.`
          : `No new ride requests for ${driver?.driverId || "this driver"} right now. Checked just now.`);
      }
    } catch (error) {
      setBookingOfferError(error?.response?.data?.message || "Unable to refresh ride offers.");
    } finally {
      if (manual) setBookingOffersLoading(false);
    }
  }, [driver?.driverId]);

  const handleBookingDriverOffer = useCallback((eventOffer) => {
    if (!eventOffer?.requestId) {
      refreshBookingOffers();
      return;
    }
    const requestId = String(eventOffer.requestId);
    const incomingOffer = {
      requestId,
      bookingId: eventOffer.bookingId,
      child: eventOffer.child || { name: eventOffer.childName || "Student", school: eventOffer.school || "" },
      route: eventOffer.route || {
        pickup: eventOffer.pickup || "",
        dropoff: eventOffer.dropoff || "",
        distanceKm: eventOffer.distanceKm,
        durationMinutes: eventOffer.durationMinutes,
        pickupTime: eventOffer.pickupTime,
        schoolPickupTime: eventOffer.schoolPickupTime,
      },
      vehicleType: eventOffer.vehicleType || "",
      monthlyRouteAmount: eventOffer.monthlyRouteAmount,
      dailyDistanceCharge: eventOffer.dailyDistanceCharge,
      workingDays: eventOffer.workingDays,
      startDate: eventOffer.startDate,
      expiresAt: eventOffer.expiresAt,
      createdAt: eventOffer.createdAt || new Date().toISOString(),
    };
    const isNewOffer = !knownBookingOfferIdsRef.current.has(requestId);
    knownBookingOfferIdsRef.current.add(requestId);
    socketBookingOffersRef.current.set(requestId, incomingOffer);
    setBookingOffers((current) => [incomingOffer, ...current.filter((offer) => offer.requestId !== requestId)]);
    if (isNewOffer) setActiveBookingOfferId(requestId);
  }, [refreshBookingOffers]);

  const handleBookingOfferCancelled = useCallback((event) => {
    if (event?.requestId) {
      const requestId = String(event.requestId);
      socketBookingOffersRef.current.delete(requestId);
      setBookingOffers((current) => current.filter((offer) => offer.requestId !== requestId));
      setActiveBookingOfferId((currentId) => currentId === requestId ? null : currentId);
    }
    refreshBookingOffers();
  }, [refreshBookingOffers]);

  const respondToBookingOffer = useCallback(async (requestId, action) => {
    setBookingOfferBusy(requestId);
    setBookingOfferError("");
    try {
      await axios.put(`/driver-request/${requestId}/${action}`);
      socketBookingOffersRef.current.delete(requestId);
      setBookingOffers((current) => current.filter((offer) => offer.requestId !== requestId));
      setActiveBookingOfferId((activeId) => activeId === requestId ? bookingOffers.find((offer) => offer.requestId !== requestId)?.requestId || null : activeId);
      if (action === "accept") setBookingOfferNotice("Ride request accepted. The parent has been notified.");
      else await refreshBookingOffers();
    } catch (error) {
      setBookingOfferError(error?.response?.data?.message || "Unable to respond to this ride request.");
      await refreshBookingOffers();
    } finally {
      setBookingOfferBusy("");
    }
  }, [bookingOffers, refreshBookingOffers]);

  useEffect(() => {
    refreshBookingOffers();
    const timer = window.setInterval(refreshBookingOffers, 5000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshBookingOffers();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshBookingOffers]);

  /* =======================================================
     SLIDER
  ======================================================= */

  const x =
    useMotionValue(0);

  const progressWidth =
    useTransform(
      x,
      [0, 250],
      ["0%", "100%"]
    );

  /* =======================================================
     VERIFY DRIVER SESSION
  ======================================================= */

  useEffect(() => {
    const token =
      localStorage.getItem(
        "accessToken"
      );

    if (
      !driver?.driverId ||
      !token
    ) {
      navigate(
        "/DriverLogin",
        {
          replace: true,
        }
      );
    }
  }, [
    driver?.driverId,
    navigate,
  ]);

  /* =======================================================
     CURRENT TIME
  ======================================================= */

  useEffect(() => {
    const interval =
      setInterval(() => {
        setCurrentHour(
          new Date().getHours()
        );
      }, 60000);

    return () => {
      clearInterval(
        interval
      );
    };
  }, []);

  const activeBookingOffer = bookingOffers.find((offer) => offer.requestId === activeBookingOfferId);

  /* =======================================================
     SELECT DEFAULT TRIP

     BEFORE 12:00 PM  -> MORNING
     12:00 PM ONWARDS -> AFTERNOON
  ======================================================= */

  useEffect(() => {
    if (
      currentHour < 12
    ) {
      setSelectedTrip(
        "morning"
      );
    } else {
      setSelectedTrip(
        "afternoon"
      );
    }
  }, [
    currentHour,
  ]);

  /* =======================================================
     ACTIVE TRIP
  ======================================================= */

  const checkActiveTrip =
    useCallback(
      async () => {
        try {
          if (
            !driver?.driverId
          ) {
            return false;
          }

          const res =
            await axios.get(
              `/trip/active/${driver.driverId}`
            );

          const activeTrips =
            res?.data?.data ||
            [];

          if (
            Array.isArray(
              activeTrips
            ) &&
            activeTrips.length >
              0
          ) {
            setTripStarted(
              true
            );

            return true;
          }

          setTripStarted(
            false
          );

          return false;
        } catch (error) {
          console.error(
            "Active trip check failed:",
            error?.response
              ?.data ||
              error
          );

          setTripStarted(
            false
          );

          return false;
        }
      },
      [
        driver?.driverId,
      ]
    );

  /* =======================================================
     TODAY STATUS
  ======================================================= */

  const fetchTripStatus =
    useCallback(
      async () => {
        try {
          if (
            !driver?.driverId
          ) {
            return;
          }

          const res =
            await axios.get(
              `/trip/today-status/${driver.driverId}`
            );

          setMorningCompleted(
            Boolean(
              res?.data?.data
                ?.morningCompleted
            )
          );

          setAfternoonCompleted(
            Boolean(
              res?.data?.data
                ?.afternoonCompleted
            )
          );
        } catch (error) {
          console.error(
            "Trip status error:",
            error?.response
              ?.data ||
              error
          );
        }
      },
      [
        driver?.driverId,
      ]
    );

  /* =======================================================
     DASHBOARD
  ======================================================= */

  const fetchDashboard =
    useCallback(
      async () => {
        try {
          if (
            !driver?.driverId
          ) {
            return;
          }

          const res =
            await axios.get(
              `/driver/dashboard/${driver.driverId}`
            );

          setDriverData(
            res?.data?.data ||
              null
          );
        } catch (error) {
          console.error(
            "Dashboard fetch failed:",
            error?.response
              ?.data ||
              error
          );

          setDriverData(
            null
          );
        }
      },
      [
        driver?.driverId,
      ]
    );

  /* =======================================================
     LOAD
  ======================================================= */

  useEffect(() => {
    const load =
      async () => {
        try {
          if (
            !driver?.driverId
          ) {
            return;
          }

          await Promise.all([
            fetchDashboard(),
            checkActiveTrip(),
            fetchTripStatus(),
          ]);
        } finally {
          setLoading(false);
        }
      };

    load();
  }, [
    driver?.driverId,
    fetchDashboard,
    checkActiveTrip,
    fetchTripStatus,
  ]);

  /* =======================================================
     NOTIFICATIONS
  ======================================================= */

  useEffect(() => {
    if (
      !driver?.driverId
    ) {
      return;
    }

    const fetchNotifications =
      async () => {
        try {
          const res =
            await axios.get(
              "/notifications"
            );

          const items =
            Array.isArray(
              res?.data?.data
            )
              ? res.data.data
              : [];

          const unread =
            items.filter(
              (item) =>
                !item.read
            ).length;

          setUnreadCount(
            unread
          );
        } catch (error) {
          console.error(
            "Notification fetch error:",
            error?.response
              ?.data ||
              error
          );
        }
      };

    fetchNotifications();
  }, [
    driver?.driverId,
  ]);

  /* =======================================================
     FLUSH ICE
  ======================================================= */

  const flushIceCandidates =
    useCallback(
      async (
        parentId
      ) => {
        const pc =
          peersRef.current[
            parentId
          ];

        const queue =
          iceCandidateQueueRef
            .current[
            parentId
          ] || [];

        if (
          !pc ||
          !pc.remoteDescription ||
          queue.length ===
            0
        ) {
          return;
        }

        while (
          queue.length
        ) {
          const candidate =
            queue.shift();

          try {
            await pc.addIceCandidate(
              new RTCIceCandidate(
                candidate
              )
            );
          } catch (error) {
            console.error(
              "ICE candidate failed:",
              error
            );
          }
        }
      },
      []
    );

  /* =======================================================
     WEBRTC
  ======================================================= */

  const createPeerConnection =
    useCallback(
      async (
        parentId
      ) => {
        if (
          !parentId ||
          peersRef.current[
            parentId
          ] ||
          !streamRef.current ||
          !socketRef.current
            ?.connected
        ) {
          return;
        }

        try {
          const pc =
            new RTCPeerConnection(
              {
                iceServers: [
                  {
                    urls:
                      "stun:stun.l.google.com:19302",
                  },
                ],
              }
            );

          peersRef.current[
            parentId
          ] = pc;

          iceCandidateQueueRef.current[
            parentId
          ] = [];

          pc.onconnectionstatechange =
            () => {
              if (
                pc.connectionState ===
                  "failed" ||
                pc.connectionState ===
                  "closed"
              ) {
                try {
                  pc.close();
                } catch {
                  // ignore
                }

                delete peersRef.current[
                  parentId
                ];

                delete iceCandidateQueueRef
                  .current[
                  parentId
                ];
              }
            };

          streamRef.current
            .getTracks()
            .forEach(
              (track) => {
                pc.addTrack(
                  track,
                  streamRef.current
                );
              }
            );

          pc.onicecandidate =
            (event) => {
              if (
                !event.candidate
              ) {
                return;
              }

              socketRef.current?.emit(
                "ice-candidate",
                {
                  candidate:
                    event.candidate,

                  parentId,
                }
              );
            };

          const offer =
            await pc.createOffer();

          await pc.setLocalDescription(
            offer
          );

          socketRef.current.emit(
            "offer",
            {
              offer,
              parentId,
            }
          );
        } catch (error) {
          console.error(
            "WebRTC peer creation failed:",
            error
          );
        }
      },
      []
    );

  /* =======================================================
     SOCKET
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

    const socket =
      io(
        SOCKET_URL,
        {
          auth: {
            token,
          },

          transports: [
            "polling",
            "websocket",
          ],

          upgrade: true,

          rememberUpgrade:
            true,

          reconnection:
            true,

          reconnectionAttempts:
            Infinity,

          reconnectionDelay:
            1000,

          reconnectionDelayMax:
            5000,

          timeout:
            20000,
        }
      );

    socketRef.current =
      socket;

    socket.on(
      "connect",
      () => {
        setBookingOfferError("");
        console.log(
          "Socket connected:",
          socket.id
        );

        socket.emit(
          "join_driver_room",
          {
            driverId:
              driver.driverId,
          }
        );
      }
    );

    socket.on("booking_driver_offer", handleBookingDriverOffer);
    socket.on("booking_request_cancelled", handleBookingOfferCancelled);

    socket.io.engine.on(
      "upgrade",
      (
        transport
      ) => {
        console.log(
          "Socket transport:",
          transport.name
        );
      }
    );

    socket.on(
      "connect_error",
      (
        error
      ) => {
        setBookingOfferError("Live requests are reconnecting. Keep this screen open; requests will refresh automatically.");
        console.error(
          "Socket error:",
          error.message
        );
      }
    );

    socket.on(
      "parent_joined",
      async ({
        parentId,
      }) => {
        await createPeerConnection(
          parentId
        );
      }
    );

    socket.on(
      "answer",
      async ({
        answer,
        parentId,
      }) => {
        if (
          !answer ||
          !parentId
        ) {
          return;
        }

        const pc =
          peersRef.current[
            parentId
          ];

        if (!pc) {
          return;
        }

        try {
          if (
            !pc.remoteDescription
          ) {
            await pc.setRemoteDescription(
              new RTCSessionDescription(
                answer
              )
            );

            await flushIceCandidates(
              parentId
            );
          }
        } catch (error) {
          console.error(
            "WebRTC answer failed:",
            error
          );
        }
      }
    );

    socket.on(
      "ice-candidate",
      async ({
        candidate,
        parentId,
      }) => {
        if (
          !candidate ||
          !parentId
        ) {
          return;
        }

        const pc =
          peersRef.current[
            parentId
          ];

        if (!pc) {
          return;
        }

        if (
          pc.remoteDescription
        ) {
          try {
            await pc.addIceCandidate(
              new RTCIceCandidate(
                candidate
              )
            );
          } catch (error) {
            console.error(
              "ICE candidate failed:",
              error
            );
          }

          return;
        }

        if (
          !iceCandidateQueueRef
            .current[
            parentId
          ]
        ) {
          iceCandidateQueueRef.current[
            parentId
          ] = [];
        }

        iceCandidateQueueRef.current[
          parentId
        ].push(
          candidate
        );
      }
    );

    socket.on(
      "parent_left",
      ({
        parentId,
      }) => {
        const pc =
          peersRef.current[
            parentId
          ];

        if (pc) {
          try {
            pc.close();
          } catch {
            // ignore
          }

          delete peersRef.current[
            parentId
          ];

          delete iceCandidateQueueRef
            .current[
            parentId
          ];
        }
      }
    );

    socket.on(
      "existing_parents",
      ({
        parentIds,
      }) => {
        if (
          !streamRef.current ||
          !Array.isArray(
            parentIds
          )
        ) {
          return;
        }

        parentIds.forEach(
          (
            parentId
          ) => {
            createPeerConnection(
              parentId
            );
          }
        );
      }
    );

    return () => {
      Object.values(
        peersRef.current
      ).forEach(
        (pc) => {
          try {
            pc.close();
          } catch {
            // ignore
          }
        }
      );

      peersRef.current = {};

      iceCandidateQueueRef.current =
        {};

      if (
        streamRef.current
      ) {
        streamRef.current
          .getTracks()
          .forEach(
            (track) =>
              track.stop()
          );

        streamRef.current =
          null;
      }

      socket.removeAllListeners();

      socket.io.removeAllListeners();

      socket.disconnect();

      socketRef.current =
        null;
    };
  }, [
    driver?.driverId,
    createPeerConnection,
    flushIceCandidates,
    refreshBookingOffers,
    handleBookingDriverOffer,
    handleBookingOfferCancelled,
  ]);

  /* =======================================================
     LOCATION
  ======================================================= */

  useEffect(() => {
    if (
      !driver?.driverId ||
      !tripStarted
    ) {
      return;
    }

    if (
      !navigator.geolocation
    ) {
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
            speed,
            heading,
            accuracy,
          } =
            position.coords;

          if (
            !socketRef.current
              ?.connected
          ) {
            return;
          }

          socketRef.current.emit(
            "send_location",
            {
              lat:
                latitude,

              lng:
                longitude,

              speed:
                Number.isFinite(
                  speed
                )
                  ? speed
                  : 0,

              heading:
                Number.isFinite(
                  heading
                )
                  ? heading
                  : 0,

              accuracy:
                Number.isFinite(
                  accuracy
                )
                  ? accuracy
                  : null,
            }
          );
        },

        (
          error
        ) => {
          console.error(
            "Location error:",
            error
          );
        },

        {
          enableHighAccuracy:
            true,

          maximumAge:
            0,

          timeout:
            10000,
        }
      );

    return () => {
      navigator.geolocation.clearWatch(
        watchId
      );
    };
  }, [
    tripStarted,
    driver?.driverId,
  ]);

  /* =======================================================
     CAMERA
  ======================================================= */

  const startCamera =
    async () => {
      try {
        if (
          streamRef.current
        ) {
          return;
        }

        if (
          !navigator.mediaDevices
            ?.getUserMedia
        ) {
          alert(
            "Camera is not supported on this device."
          );

          return;
        }

        const permissionStream =
          await navigator.mediaDevices.getUserMedia(
            {
              video: true,
              audio: false,
            }
          );

        permissionStream
          .getTracks()
          .forEach(
            (track) =>
              track.stop()
          );

        const devices =
          await navigator.mediaDevices.enumerateDevices();

        const cameras =
          devices.filter(
            (
              device
            ) =>
              device.kind ===
              "videoinput"
          );

        if (
          cameras.length ===
          0
        ) {
          alert(
            "No camera found."
          );

          return;
        }

        if (
          cameras.length ===
          1
        ) {
          await handleCameraSelect(
            cameras[0]
              .deviceId
          );

          return;
        }

        setVideoDevices(
          cameras
        );

        setShowCameraSelect(
          true
        );
      } catch (error) {
        console.error(
          "Camera permission error:",
          error
        );

        alert(
          "Unable to access camera."
        );
      }
    };

  /* =======================================================
     CAMERA SELECT
  ======================================================= */

  const handleCameraSelect =
    async (
      deviceId
    ) => {
      try {
        setShowCameraSelect(
          false
        );

        if (
          streamRef.current
        ) {
          streamRef.current
            .getTracks()
            .forEach(
              (track) =>
                track.stop()
            );

          streamRef.current =
            null;
        }

        const constraints =
          deviceId
            ? {
                video: {
                  deviceId: {
                    exact:
                      deviceId,
                  },
                },

                audio:
                  false,
              }
            : {
                video:
                  true,

                audio:
                  false,
              };

        const stream =
          await navigator.mediaDevices.getUserMedia(
            constraints
          );

        streamRef.current =
          stream;

        if (
          videoRef.current
        ) {
          videoRef.current.srcObject =
            stream;

          await videoRef.current
            .play()
            .catch(
              () => {}
            );
        }

        if (
          socketRef.current
            ?.connected
        ) {
          socketRef.current.emit(
            "driver_camera_ready"
          );
        }
      } catch (error) {
        console.error(
          "Camera start failed:",
          error
        );

        alert(
          "Unable to start camera."
        );
      }
    };

  /* =======================================================
     STOP CAMERA
  ======================================================= */

  const stopCamera =
    () => {
      Object.values(
        peersRef.current
      ).forEach(
        (pc) => {
          try {
            pc.close();
          } catch {
            // ignore
          }
        }
      );

      peersRef.current =
        {};

      iceCandidateQueueRef.current =
        {};

      if (
        streamRef.current
      ) {
        streamRef.current
          .getTracks()
          .forEach(
            (track) =>
              track.stop()
          );

        streamRef.current =
          null;
      }

      if (
        videoRef.current
      ) {
        videoRef.current.srcObject =
          null;
      }
    };

  /* =======================================================
     START TRIP

     MORNING   : before 12:00 PM
     AFTERNOON : 12:00 PM - 5:59 PM
  ======================================================= */

  const startTrip =
    async () => {
      try {
        if (
          !driver?.driverId
        ) {
          alert(
            "Driver not found. Please login again."
          );

          return;
        }

        /* ===============================================
           MORNING EXPIRES AT 12:00 PM
           LAST VALID TIME = 11:59 AM
        =============================================== */

        if (
          selectedTrip ===
            "morning" &&
          currentHour >= 12
        ) {
          alert(
            "Morning duty has expired."
          );

          return;
        }

        /* ===============================================
           AFTERNOON STARTS AT 12:00 PM
        =============================================== */

        if (
          selectedTrip ===
            "afternoon" &&
          currentHour < 12
        ) {
          alert(
            "Afternoon duty is not yet active."
          );

          return;
        }

        /* ===============================================
           AFTERNOON EXPIRES AT 6:00 PM
           LAST VALID TIME = 5:59 PM
        =============================================== */

        if (
          selectedTrip ===
            "afternoon" &&
          currentHour >= 18
        ) {
          alert(
            "Afternoon duty has expired."
          );

          return;
        }

        await axios.post(
          "/trip/start",
          {
            driverId:
              driver.driverId,

            tripType:
              selectedTrip,
          }
        );

        const active =
          await checkActiveTrip();

        if (
          !active
        ) {
          alert(
            "Trip started but active trip could not be loaded."
          );

          return;
        }

        setTripStarted(
          true
        );

        setTimeout(
          () => {
            startCamera();
          },
          500
        );

        fetchTripStatus();
      } catch (error) {
        console.error(
          "Start trip error:",
          error?.response
            ?.data ||
            error
        );

        alert(
          error?.response?.data
            ?.message ||
            "Trip start failed."
        );
      }
    };

  /* =======================================================
     END TRIP
  ======================================================= */

  const handleEndTripCleanup =
    () => {
      stopCamera();

      if (
        selectedTrip ===
        "morning"
      ) {
        setMorningCompleted(
          true
        );
      }

      if (
        selectedTrip ===
        "afternoon"
      ) {
        setAfternoonCompleted(
          true
        );
      }

      setTripStarted(
        false
      );

      fetchTripStatus();
    };

  /* =======================================================
     STATUS HELPERS
  ======================================================= */

  const getDutyStatus =
    () => {
      /* ===================================================
         MORNING
      =================================================== */

      if (
        selectedTrip ===
        "morning"
      ) {
        if (
          morningCompleted
        ) {
          return {
            label:
              "COMPLETED",

            style:
              "bg-[#EAF5E8] text-[#4C7D46]",
          };
        }

        /*
          Morning stays READY
          until 11:59 AM.

          At 12:00 PM it becomes PASSED.
        */

        if (
          currentHour >= 12
        ) {
          return {
            label:
              "PASSED",

            style:
              "bg-[#FCEBE9] text-[#B6544D]",
          };
        }

        return {
          label:
            "READY",

          style:
            "bg-[#FFF0BF] text-[#916100]",
        };
      }

      /* ===================================================
         AFTERNOON
      =================================================== */

      if (
        afternoonCompleted
      ) {
        return {
          label:
            "COMPLETED",

          style:
            "bg-[#EAF5E8] text-[#4C7D46]",
        };
      }

      /*
        Afternoon starts at
        12:00 PM.
      */

      if (
        currentHour < 12
      ) {
        return {
          label:
            "UPCOMING",

          style:
            "bg-[#F1EEE7] text-[#8E877D]",
        };
      }

      /*
        Afternoon expires
        at 6:00 PM.
      */

      if (
        currentHour >= 18
      ) {
        return {
          label:
            "PASSED",

          style:
            "bg-[#FCEBE9] text-[#B6544D]",
        };
      }

      return {
        label:
          "READY",

        style:
          "bg-[#FFF0BF] text-[#916100]",
      };
    };

  const dutyStatus =
    getDutyStatus();

  /* =======================================================
     LOADING
  ======================================================= */

  if (
    loading
  ) {
    return (
      <div className="min-h-screen bg-[#FFF9EE] flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-9 h-9 border-[3px] border-[#FFB000] border-t-transparent rounded-full animate-spin" />

          <p className="mt-4 text-[10px] font-semibold text-[#8D8174]">
            Loading duty...
          </p>
        </div>
      </div>
    );
  }

  /* =======================================================
     INVALID SESSION
  ======================================================= */

  if (
    !driver?.driverId
  ) {
    return (
      <div className="min-h-screen bg-[#FFF9EE] flex items-center justify-center px-5">
        <div className="w-full max-w-sm rounded-[22px] border border-[#EEE3D1] bg-[#FFFDF8] p-6 text-center">
          <h2 className="text-[17px] font-black text-black">
            Session Expired
          </h2>

          <p className="mt-2 text-[10px] text-[#8C8276]">
            Login again to continue your duty.
          </p>

          <button
            type="button"
            onClick={() =>
              navigate(
                "/DriverLogin"
              )
            }
            className="mt-5 h-12 w-full rounded-[15px] bg-[#FFB000] text-[12px] font-black text-black"
          >
            LOGIN AGAIN
          </button>
        </div>
      </div>
    );
  }

  /* =======================================================
     UI
  ======================================================= */

  return (
    <>
      {/* ===================================================
          HIDDEN CAMERA
      =================================================== */}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: "1px",
          height: "1px",
          opacity: 0,
          position: "fixed",
          pointerEvents:
            "none",
        }}
      />

      {activeBookingOffer && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 p-0 backdrop-blur-[3px] sm:items-center sm:p-5" role="presentation">
          <section className="w-full max-w-[440px] overflow-hidden rounded-t-[28px] border border-[#EED69B] bg-[#FFFDF8] shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:rounded-[28px]" role="dialog" aria-modal="true" aria-labelledby="booking-offer-title">
            <div className="h-1.5 bg-[#FFB000]" />
            <div className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[9px] font-black tracking-[0.18em] text-[#B87700]">NEW ROUTE SERVICE REQUEST</p>
                  <h2 id="booking-offer-title" className="mt-1 text-[21px] font-black text-black">You have a new ride request</h2>
                  <p className="mt-1 text-[11px] text-[#8C8276]">Check the student, schedule and route details before responding.</p>
                </div>
                <div className="shrink-0 rounded-[16px] bg-[#FFF1C8] px-3 py-2 text-right">
                  <p className="text-[7px] font-black tracking-[0.12em] text-[#8C6A18]">MONTHLY ROUTE AMOUNT</p>
                  <p className="mt-0.5 text-[19px] font-black text-[#936400]">₹{Number(activeBookingOffer.monthlyRouteAmount || 0).toLocaleString("en-IN")}</p>
                  <p className="mt-0.5 text-[7px] font-semibold text-[#8C6A18]">Distance charges only</p>
                </div>
              </div>
              <div className="mt-5 rounded-[18px] border border-[#EFE4D0] bg-white p-4">
                <p className="text-[8px] font-black tracking-[0.14em] text-[#95897C]">STUDENT</p>
                <p className="mt-1 text-[15px] font-black text-black">{activeBookingOffer.child?.name || "Student"}</p>
                <p className="mt-0.5 text-[10px] text-[#766D61]">{activeBookingOffer.child?.school || "School not specified"}{activeBookingOffer.child?.grade ? ` · ${activeBookingOffer.child.grade}` : ""}</p>
                <div className="my-3 border-t border-dashed border-[#E8DCC8]" />
                <div className="space-y-2.5 text-[10px] text-[#51483B]">
                  <p><b>Home pickup:</b> {activeBookingOffer.route?.pickup || "—"}{activeBookingOffer.route?.pickupTime ? ` · ${activeBookingOffer.route.pickupTime}` : ""}</p>
                  <p><b>School:</b> {activeBookingOffer.route?.dropoff || "—"}{activeBookingOffer.route?.schoolPickupTime ? ` · ${activeBookingOffer.route.schoolPickupTime}` : ""}</p>
                  <p><b>Route details:</b> {activeBookingOffer.route?.distanceKm || "—"} km · {activeBookingOffer.route?.durationMinutes || "—"} min · {activeBookingOffer.vehicleType || "Vehicle not specified"}</p>
                  {activeBookingOffer.startDate && <p><b>Requested start:</b> {new Date(activeBookingOffer.startDate).toLocaleDateString("en-IN")}</p>}
                </div>
              </div>
              {bookingOfferError && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[10px] font-semibold text-red-700">{bookingOfferError}</p>}
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <button type="button" disabled={Boolean(bookingOfferBusy)} onClick={() => respondToBookingOffer(activeBookingOffer.requestId, "decline")} className="h-12 rounded-[15px] border border-[#E5DAC8] bg-white text-[11px] font-black text-[#6D6255] disabled:opacity-50">{bookingOfferBusy === activeBookingOffer.requestId ? "Please wait…" : "Decline"}</button>
                <button type="button" disabled={Boolean(bookingOfferBusy)} onClick={() => respondToBookingOffer(activeBookingOffer.requestId, "accept")} className="h-12 rounded-[15px] bg-[#FFB000] text-[11px] font-black text-black disabled:opacity-50">{bookingOfferBusy === activeBookingOffer.requestId ? "Please wait…" : "Accept request"}</button>
              </div>
              <button type="button" disabled={Boolean(bookingOfferBusy)} onClick={() => setActiveBookingOfferId(null)} className="mt-3 h-10 w-full text-[10px] font-bold text-[#8C8276] disabled:opacity-50">Review later</button>
            </div>
          </section>
        </div>
      )}

      {/* ===================================================
          CAMERA MODAL
      =================================================== */}

      {showCameraSelect && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/35">
          <div className="w-full max-w-[475px] rounded-t-[28px] bg-[#FFFDF8] px-5 pb-7 pt-4">
            <div className="mx-auto h-1 w-10 rounded-full bg-[#DCD5C9]" />

            <h2 className="mt-6 text-[18px] font-black text-black">
              Select Camera
            </h2>

            <p className="mt-1 text-[10px] text-[#8C8276]">
              Choose the camera for this duty.
            </p>

            <div className="mt-5 space-y-2">
              {videoDevices.map(
                (
                  camera,
                  index
                ) => (
                  <button
                    type="button"
                    key={
                      camera.deviceId ||
                      index
                    }
                    onClick={() =>
                      handleCameraSelect(
                        camera.deviceId
                      )
                    }
                    className="w-full rounded-[16px] border border-[#EEE3D1] bg-white px-4 py-4 text-left"
                  >
                    <p className="text-[12px] font-bold text-black">
                      {camera.label ||
                        `Camera ${
                          index +
                          1
                        }`}
                    </p>
                  </button>
                )
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                setShowCameraSelect(
                  false
                )
              }
              className="mt-4 h-12 w-full rounded-[15px] bg-[#F2EEE7] text-[11px] font-bold text-[#746D65]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!tripStarted ? (
        <div className="min-h-screen bg-[#FFF9EE] flex justify-center">
          <div className="relative min-h-screen w-full max-w-[475px] overflow-hidden bg-[#FFF9EE] pb-[98px]">

            {/* =================================================
                SUBTLE BACKGROUND
            ================================================= */}

            <div className="pointer-events-none absolute -right-[130px] -top-[150px] h-[330px] w-[330px] rounded-full bg-[#FFEDB9]/75" />

            <div className="pointer-events-none absolute -left-[180px] top-[450px] h-[300px] w-[300px] rounded-full bg-[#FFF2D1]/50" />

            {/* =================================================
                HEADER
            ================================================= */}

            <header className="relative z-10 px-5 pb-4 pt-7">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[8px] font-black tracking-[0.17em] text-[#B87700]">
                    WELCOME BACK
                  </p>

                  <h1 className="mt-3 text-[23px] leading-[1.08] tracking-[-0.025em] font-black text-black">
                    {currentHour <
                    12
                      ? "Good morning,"
                      : currentHour <
                          18
                        ? "Good afternoon,"
                        : "Good evening,"}

                    <br />

                    {driverData?.name ||
                      driver?.name ||
                      "Driver"}
                  </h1>

                  <div className="mt-2 flex items-center gap-1.5 text-[9px] font-medium text-[#8C8276]">
                    <span>
                      {driverData?.vehicleNumber ||
                        driver?.vehicleNumber ||
                        "--"}
                    </span>

                    <span className="h-1 w-1 rounded-full bg-[#C9BEAF]" />

                    <span>
                      {driverData?.vehicleType ||
                        driver?.vehicleType ||
                        "--"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/notifications"
                    )
                  }
                  className="relative flex h-11 w-11 items-center justify-center rounded-[15px] border border-[#EEE1CB] bg-[#FFFDF8]"
                >
                  <Bell
                    size={19}
                    strokeWidth={
                      1.9
                    }
                    className="text-black"
                  />

                  {unreadCount >
                    0 && (
                    <span className="absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-red-500 px-1 text-[7px] font-bold text-white">
                      {unreadCount >
                      99
                        ? "99+"
                        : unreadCount}
                    </span>
                  )}
                </button>
              </div>
            </header>

            {/* =================================================
                MAIN CONTENT
            ================================================= */}

            <main className="relative z-10 space-y-4 px-4">

              {/* =================================================
                  DUTY HEADER
              ================================================= */}

              <div className="px-1 pt-2">
                <div className="flex items-center gap-2">
                  <Navigation
                    size={13}
                    className="text-[#B87700]"
                  />

                  <p className="text-[8px] font-black tracking-[0.16em] text-[#B87700]">
                    TODAY'S DUTY
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => refreshBookingOffers({ manual: true })}
                disabled={bookingOffersLoading}
                className="flex w-full items-center justify-between rounded-[18px] border border-[#EED69B] bg-white px-4 py-3 text-left shadow-[0_8px_24px_rgba(140,100,0,0.07)] disabled:opacity-70"
                aria-label={`Ride requests${bookingOffers.length ? `, ${bookingOffers.length} new` : ""}`}
              >
                <span>
                  <span className="block text-[11px] font-black text-black">Ride requests</span>
                  <span className="mt-0.5 block text-[9px] text-[#8C8276]">{bookingOffers.length ? "You have a new ride request. Check once." : bookingOffersLoading ? "Checking for new requests…" : `Signed in as ${driver?.driverId || "driver"} · tap to check`}</span>
                </span>
                <span className="rounded-full bg-[#FFB000] px-3 py-1.5 text-[9px] font-black text-black">{bookingOffersLoading ? "…" : bookingOffers.length || "Check"}</span>
              </button>

              {bookingOfferNotice && <div className="rounded-[15px] border border-[#B8DEC7] bg-[#EEF8F1] px-4 py-3 text-[10px] font-bold text-[#2F7149]">{bookingOfferNotice}</div>}
              {bookingOfferError && !activeBookingOffer && (
                <div className="flex items-center justify-between gap-3 rounded-[15px] border border-[#F1C8C4] bg-[#FFF3F1] px-4 py-3 text-[10px] font-semibold text-[#A43C32]" role="status" aria-live="polite">
                  <span>{bookingOfferError}</span>
                  <button type="button" onClick={() => refreshBookingOffers({ manual: true })} className="shrink-0 font-black underline underline-offset-2">Retry</button>
                </div>
              )}

              {bookingOffers.length > 0 && (
                <section className="space-y-3" aria-label="New ride requests">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-[8px] font-black tracking-[0.16em] text-[#B87700]">NEW RIDE REQUESTS</p>
                    <span className="rounded-full bg-[#FFB000] px-2.5 py-1 text-[8px] font-black text-black">{bookingOffers.length} NEW</span>
                  </div>
                  {bookingOffers.map((offer) => (
                    <article key={offer.requestId} className="overflow-hidden rounded-[22px] border border-[#EED69B] bg-[#FFFDF8]">
                      <div className="h-[4px] bg-[#FFB000]" />
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[8px] font-bold tracking-[0.12em] text-[#95897C]">ROUTE SERVICE REQUEST</p>
                            <h3 className="mt-1 text-[16px] font-black text-black">{offer.child?.name || "Student"}</h3>
                            <p className="mt-0.5 truncate text-[9px] text-[#8C8276]">{offer.child?.school || "School route"}</p>
                            <p className="mt-1 text-[8px] font-bold text-[#9A6A00]">Sent to ASAN ID {offer.targetDriverId || driver?.driverId || "this driver"}</p>
                          </div>
                          <p className="shrink-0 text-right text-[17px] font-black text-[#936400]">₹{Number(offer.monthlyRouteAmount || 0).toLocaleString("en-IN")}<span className="block text-[7px] font-bold text-[#95897C]">MONTHLY ROUTE AMOUNT</span><span className="block text-[7px] font-semibold text-[#8C6A18]">Distance charges only</span></p>
                        </div>
                        <div className="mt-3 space-y-2 rounded-[14px] bg-[#FFF8E8] p-3 text-[9px] text-[#51483B]">
                          <p><b>Home pickup:</b> {offer.route?.pickup || "—"}{offer.route?.pickupTime ? ` · ${offer.route.pickupTime}` : ""}</p>
                          <p><b>School:</b> {offer.route?.dropoff || "—"}{offer.route?.schoolPickupTime ? ` · ${offer.route.schoolPickupTime}` : ""}</p>
                          <p className="text-[#8C8276]">{offer.route?.distanceKm || "—"} km · {offer.route?.durationMinutes || "—"} min · {offer.vehicleType || "Vehicle not specified"}</p>
                          {offer.startDate && <p><b>Requested start:</b> {new Date(offer.startDate).toLocaleDateString("en-IN")}</p>}
                        </div>
                        {bookingOfferError && <p className="mt-2 text-[9px] font-semibold text-red-600">{bookingOfferError}</p>}
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button type="button" disabled={Boolean(bookingOfferBusy)} onClick={() => respondToBookingOffer(offer.requestId, "decline")} className="h-10 rounded-[13px] border border-[#E5DAC8] bg-white text-[9px] font-black text-[#6D6255] disabled:opacity-50">{bookingOfferBusy === offer.requestId ? "Please wait…" : "Decline"}</button>
                          <button type="button" disabled={Boolean(bookingOfferBusy)} onClick={() => respondToBookingOffer(offer.requestId, "accept")} className="h-10 rounded-[13px] bg-[#FFB000] text-[9px] font-black text-black disabled:opacity-50">{bookingOfferBusy === offer.requestId ? "Please wait…" : "Accept request"}</button>
                        </div>
                      </div>
                    </article>
                  ))}
                </section>
              )}

              {/* =================================================
                  PRIMARY DUTY CARD
              ================================================= */}

              <section className="overflow-hidden rounded-[22px] border border-[#EED69B] bg-[#FFFDF8]">
                <div className="h-[5px] bg-[#FFB000]" />

                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[8px] font-bold text-[#95897C]">
                        CURRENT SELECTION
                      </p>

                      <h2 className="mt-1.5 text-[20px] font-black capitalize text-black">
                        {selectedTrip}{" "}
                        Duty
                      </h2>

                      <p className="mt-1 text-[9px] text-[#8C8276]">
                        {selectedTrip ===
                        "morning"
                          ? "Home Pickups → School"
                          : "School → Home Drops"}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1.5 text-[7px] font-black ${dutyStatus.style}`}
                    >
                      {
                        dutyStatus.label
                      }
                    </span>
                  </div>

                  {/* =================================================
                      TRIP SELECT
                  ================================================= */}

                  <div className="mt-5 grid grid-cols-2 gap-2">

                    {/* MORNING */}

                    <button
                      type="button"
                      onClick={() => {
                        if (
                          currentHour >=
                          12
                        ) {
                          alert(
                            "Morning duty has expired."
                          );

                          return;
                        }

                        setSelectedTrip(
                          "morning"
                        );
                      }}
                      className={`rounded-[16px] border px-3 py-3 text-left transition ${
                        selectedTrip ===
                        "morning"
                          ? "border-[#E8B949] bg-[#FFF3D3]"
                          : "border-[#EEE4D5] bg-white"
                      } ${
                        currentHour >=
                        12
                          ? "opacity-45 cursor-not-allowed"
                          : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <CloudSun
                          size={
                            17
                          }
                          className="text-[#AA7000]"
                        />

                        {selectedTrip ===
                          "morning" && (
                          <CheckCircle2
                            size={
                              15
                            }
                            className="text-[#AA7000]"
                          />
                        )}
                      </div>

                      <p className="mt-2 text-[10px] font-black text-black">
                        Morning
                      </p>

                      <p className="mt-0.5 text-[7px] text-[#9B9185]">
                        Home → School
                      </p>
                    </button>

                    {/* AFTERNOON */}

                    <button
                      type="button"
                      onClick={() => {
                        if (
                          currentHour <
                          12
                        ) {
                          alert(
                            "Afternoon duty is not yet active."
                          );

                          return;
                        }

                        if (
                          currentHour >=
                          18
                        ) {
                          alert(
                            "Afternoon duty has expired."
                          );

                          return;
                        }

                        setSelectedTrip(
                          "afternoon"
                        );
                      }}
                      className={`rounded-[16px] border px-3 py-3 text-left transition ${
                        selectedTrip ===
                        "afternoon"
                          ? "border-[#E8B949] bg-[#FFF3D3]"
                          : "border-[#EEE4D5] bg-white"
                      } ${
                        currentHour <
                          12 ||
                        currentHour >=
                          18
                          ? "opacity-45 cursor-not-allowed"
                          : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <Sun
                          size={
                            17
                          }
                          className="text-[#AA7000]"
                        />

                        {selectedTrip ===
                          "afternoon" && (
                          <CheckCircle2
                            size={
                              15
                            }
                            className="text-[#AA7000]"
                          />
                        )}
                      </div>

                      <p className="mt-2 text-[10px] font-black text-black">
                        Afternoon
                      </p>

                      <p className="mt-0.5 text-[7px] text-[#9B9185]">
                        School → Home
                      </p>
                    </button>
                  </div>
                </div>
              </section>

              {/* =================================================
                  CALL TO ACTION
              ================================================= */}

              <section>
                <div className="mb-2 flex items-end justify-between px-1">
                  <div>
                    <p className="text-[13px] font-black text-black">
                      Ready to start?
                    </p>

                    <p className="mt-0.5 text-[8px] text-[#91877B]">
                      GPS and camera start automatically.
                    </p>
                  </div>
                </div>

                {selectedTrip ===
                  "morning" &&
                morningCompleted ? (
                  <div className="flex h-[58px] items-center justify-center gap-2 rounded-[18px] border border-[#CEE4CB] bg-[#EEF7EC]">
                    <CheckCircle2
                      size={18}
                      className="text-[#4E854A]"
                    />

                    <p className="text-[10px] font-black text-[#4E854A]">
                      Morning Duty Completed
                    </p>
                  </div>
                ) : selectedTrip ===
                    "afternoon" &&
                  afternoonCompleted ? (
                  <div className="flex h-[58px] items-center justify-center gap-2 rounded-[18px] border border-[#CEE4CB] bg-[#EEF7EC]">
                    <CheckCircle2
                      size={18}
                      className="text-[#4E854A]"
                    />

                    <p className="text-[10px] font-black text-[#4E854A]">
                      Afternoon Duty Completed
                    </p>
                  </div>
                ) : (
                  <div
                    ref={
                      sliderRef
                    }
                    className="relative flex h-[60px] items-center overflow-hidden rounded-full border border-[#E9CB84] bg-[#FFF1C8] px-[5px]"
                  >
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-[17px] bg-[#FFD86A]"
                      style={{
                        width:
                          progressWidth,
                      }}
                    />

                    <motion.div
                      drag="x"
                      dragConstraints={{
                        left: 0,
                        right:
                          240,
                      }}
                      dragElastic={
                        0
                      }
                      style={{
                        x,
                      }}
                      onDragEnd={() => {
                        const value =
                          x.get();

                        animate(
                          x,
                          0
                        );

                        if (
                          value >
                          150
                        ) {
                          startTrip();
                        }
                      }}
                      className="relative z-10 flex h-[50px] w-[50px] cursor-grab items-center justify-center rounded-full bg-[#FFB000]"
                    >
                      <Play
                        size={
                          17
                        }
                        fill="currentColor"
                        className="text-black"
                      />
                    </motion.div>

                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center pl-9">
                      <p className="text-[10px] font-black text-[#7B5600]">
                        Slide to
                        Start{" "}
                        {selectedTrip ===
                        "morning"
                          ? "Morning"
                          : "Afternoon"}{" "}
                        Duty
                      </p>
                    </div>
                  </div>
                )}
              </section>

              {/* =================================================
                  QUICK DUTY SUMMARY
              ================================================= */}

              <section>
                <div className="mb-2 px-1">
                  <p className="text-[8px] font-black tracking-[0.15em] text-[#B87700]">
                    DUTY SUMMARY
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[18px] border border-[#EEE4D5] bg-[#FFFDF8] p-4">
                    <Users
                      size={17}
                      className="text-[#B87700]"
                    />

                    <p className="mt-3 text-[22px] leading-none font-black text-black">
                      {driverData?.studentsAssigned ??
                        0}
                    </p>

                    <p className="mt-1.5 text-[7px] font-bold tracking-[0.09em] text-[#978C7F]">
                      STUDENTS
                    </p>
                  </div>

                  <div className="rounded-[18px] border border-[#EEE4D5] bg-[#FFFDF8] p-4">
                    <Flag
                      size={17}
                      className="text-[#B87700]"
                    />

                    <p className="mt-3 text-[22px] leading-none font-black text-black">
                      {driverData?.todayTrips ??
                        0}
                    </p>

                    <p className="mt-1.5 text-[7px] font-bold tracking-[0.09em] text-[#978C7F]">
                      TRIPS TODAY
                    </p>
                  </div>
                </div>
              </section>

              {/* =================================================
                  VEHICLE
              ================================================= */}

              <section className="flex items-center justify-between rounded-[18px] border border-[#EEE4D5] bg-[#FFFDF8] px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-[#FFF0C5]">
                    <MapPin
                      size={16}
                      className="text-[#A97000]"
                    />
                  </div>

                  <div>
                    <p className="text-[8px] font-bold text-[#998E81]">
                      YOUR VEHICLE
                    </p>

                    <p className="mt-0.5 text-[11px] font-black text-black">
                      {driverData?.vehicleNumber ||
                        driver?.vehicleNumber ||
                        "--"}
                    </p>
                  </div>
                </div>

                <p className="text-[9px] font-semibold text-[#91877A]">
                  {driverData?.vehicleType ||
                    driver?.vehicleType ||
                    "--"}
                </p>
              </section>
            </main>

            {/* =================================================
                NAVIGATION
            ================================================= */}

            <div className="fixed bottom-3 left-1/2 z-50 w-[calc(100%-32px)] max-w-[443px] -translate-x-1/2">
              <nav className="flex h-[70px] items-center justify-around rounded-[22px] border border-[#EEE1CC] bg-[#FFFDF8] px-2 shadow-[0_7px_24px_rgba(100,70,20,0.07)]">
                {[
                  {
                    icon:
                      Home,
                    label:
                      "Home",
                    path:
                      "/dashboard",
                  },
                  {
                    icon:
                      Users,
                    label:
                      "Students",
                    path:
                      "/students",
                  },
                  {
                    icon:
                      Clock,
                    label:
                      "Trips",
                    path:
                      "/trips",
                  },
                  {
                    icon:
                      User,
                    label:
                      "Profile",
                    path:
                      "/profile",
                  },
                ].map(
                  (
                    item
                  ) => {
                    const Icon =
                      item.icon;

                    const active =
                      item.path ===
                      "/dashboard";

                    return (
                      <button
                        type="button"
                        key={
                          item.path
                        }
                        onClick={() =>
                          navigate(
                            item.path
                          )
                        }
                        className="relative flex h-full min-w-[62px] flex-col items-center justify-center"
                      >
                        <Icon
                          size={
                            18
                          }
                          strokeWidth={
                            active
                              ? 2.4
                              : 1.8
                          }
                          className={
                            active
                              ? "text-[#B87700]"
                              : "text-[#A8A29A]"
                          }
                        />

                        <span
                          className={`mt-1 text-[7px] ${
                            active
                              ? "font-black text-[#B87700]"
                              : "font-medium text-[#A8A29A]"
                          }`}
                        >
                          {
                            item.label
                          }
                        </span>

                        {active && (
                          <span className="absolute bottom-[5px] h-1 w-1 rounded-full bg-[#FFB000]" />
                        )}
                      </button>
                    );
                  }
                )}
              </nav>
            </div>
          </div>
        </div>
      ) : (
        <ActiveTripScreen
          onEndTrip={
            handleEndTripCleanup
          }
        />
      )}
    </>
  );
}

export default DriverDashboard;
