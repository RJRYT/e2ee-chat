import React, { useState, useRef, useEffect } from "react";
import axiosInstance from "../services/api";
import {
  FaCamera,
  FaVideo,
  FaMicrophone,
  FaFileAlt,
  FaSmile,
  FaPaperPlane,
} from "react-icons/fa";
import { IoMdClose } from "react-icons/io";

const MultimediaUpload = ({
  chatId,
  onUploadSuccess,
  onCancel,
  setShowEmojiPicker,
  messageText,
}) => {
  const [mediaType, setMediaType] = useState(null); // "image", "video", "voice", "file"
  const [mediaFile, setMediaFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);

  const [isRecording, setIsRecording] = useState(false);
  const recordedChunksRef = useRef([]);
  const [liveMode, setLiveMode] = useState(false); // indicates live capture modal is open
  const [isLoading, setIsLoading] = useState(false); // loading state while starting stream
  const [liveCaptureMode, setLiveCaptureMode] = useState(null); // "image", "video", "audio"
  const [recordTime, setRecordTime] = useState(0);
  const recordTimerRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);

  // Reset all states and close modal
  const reset = () => {
    setMediaType(null);
    setMediaFile(null);
    setPreviewUrl(null);
    setUploadProgress(0);
    setUploadError(null);
    setIsRecording(false);
    recordedChunksRef.current = [];
    setLiveMode(false);
    setLiveCaptureMode(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    onCancel();
  };

  const waitForVideoElement = () =>
    new Promise((resolve) => {
      const interval = setInterval(() => {
        if (videoRef.current) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });

  async function requestMediaPermissions() {
    try {
      // Explicitly request permission first
      const permissions = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      return permissions;
    } catch (err) {
      console.error("User denied permissions:", err);
      setUploadError("User denied permissions");
      alert("Please allow access to the camera and microphone.");
      return null;
    }
  }

  // Start live capture (opens modal)
  const startLiveCapture = async (mode) => {
    setLiveCaptureMode(mode);
    setLiveMode(true);
    setIsLoading(true);
    const streamCheck = await requestMediaPermissions();
    if (!streamCheck) return; // Stop if permissions are denied
    try {
      if (mode !== "audio") {
        await waitForVideoElement();
      }
      let constraints = {};
      if (mode === "audio") {
        constraints = { audio: true };
      } else {
        constraints = { video: true, audio: mode === "video" };
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setIsLoading(false);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error("Error accessing media devices", err);
      setUploadError("Error accessing media devices");
      setIsLoading(false);
    }
  };

  // ----- Image Capture -----
  const captureImage = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "photo.png", { type: "image/png" });
        setMediaFile(file);
        setMediaType("image");
        setPreviewUrl(URL.createObjectURL(blob));
        // Stop the stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
        setLiveMode(false);
        setLiveCaptureMode(null);
      } else {
        setUploadError("Failed to capture image");
      }
    }, "image/png");
  };

  // ----- Video Capture -----
  const startVideoRecording = () => {
    if (!streamRef.current) return;
    recordedChunksRef.current = [];
    const options = { mimeType: "video/webm;codecs=vp9" };
    // Start timer
    recordTimerRef.current = setInterval(() => {
      setRecordTime((prev) => prev + 1);
    }, 1000);
    const recorder = new MediaRecorder(streamRef.current, options);
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        recordedChunksRef.current.push(e.data);
      }
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
  };

  const stopVideoRecording = async () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      clearInterval(recordTimerRef.current);
      setRecordTime(0);
      setIsRecording(false);
      mediaRecorderRef.current.onstop = () => {
        const chunks = recordedChunksRef.current;
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
        if (chunks.length === 0) {
          setUploadError("No data recorded. Please try again.");
          return;
        }
        const blob = new Blob(chunks, { type: "video/webm" });
        const file = new File([blob], "video.webm", { type: "video/webm" });
        setPreviewUrl(URL.createObjectURL(blob));
        setMediaFile(file);
        setMediaType("video");
        setLiveMode(false);
        setLiveCaptureMode(null);
      };
    }
  };

  // ----- Audio Capture -----
  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      recordedChunksRef.current = [];
      // Start timer
      recordTimerRef.current = setInterval(() => {
        setRecordTime((prev) => prev + 1);
      }, 1000);
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone", err);
      setUploadError("Error accessing microphone");
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      clearInterval(recordTimerRef.current);
      setRecordTime(0);
      setIsRecording(false);
      mediaRecorderRef.current.onstop = () => {
        const chunks = recordedChunksRef.current;
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
        if (chunks.length === 0) {
          setUploadError("No data recorded. Please try again.");
          return;
        }
        const blob = new Blob(chunks, { type: "audio/webm" });
        const file = new File([blob], "voice.webm", { type: "audio/webm" });
        setPreviewUrl(URL.createObjectURL(blob));
        setMediaFile(file);
        setMediaType("voice");
        setLiveMode(false);
        setLiveCaptureMode(null);
      };
    }
  };

  // ----- File Upload (Regular) -----
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setMediaFile(file);
    let type = "file";
    if (file.type.startsWith("image/")) type = "image";
    else if (file.type.startsWith("video/")) type = "video";
    else if (file.type.startsWith("audio/")) type = "voice";
    else if (file.type.startsWith("application/")) type = "document";
    setMediaType(type);
    setPreviewUrl(URL.createObjectURL(file));
  };

  // ----- Upload Function with Progress -----
  const handleUpload = async () => {
    if (!mediaFile) return;
    const formData = new FormData();
    formData.append("file", mediaFile);
    formData.append("mediaType", mediaType);
    formData.append("text", messageText || "");
    try {
      const response = await axiosInstance.post(
        `/chats/${chatId}/message`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (progressEvent) => {
            const progress = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(progress);
          },
        }
      );
      setUploadProgress(0);
      reset();
      onUploadSuccess && onUploadSuccess(response.data);
    } catch (err) {
      console.error("Upload failed", err);
      setUploadError("Upload failed. Please try again.");
    }
  };

  return (
    <div>
      {/* Live Capture Modal Popup */}
      {liveMode && liveCaptureMode && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-4 rounded shadow-lg relative max-w-lg w-full">
            <button
              onClick={reset}
              className="absolute top-0 right-0 m-1 text-red-500 font-bold"
            >
              <IoMdClose size={25} />
            </button>

            {isLoading && <div className="text-center">Loading...</div>}
            {(liveCaptureMode === "image" || liveCaptureMode === "video") && (
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                className="w-full h-auto"
              />
            )}
            {liveCaptureMode === "audio" && !isLoading && (
              <div className="text-center p-4">Ready to record</div>
            )}
            {isRecording && (
              <div className="text-center text-sm text-gray-700 mt-2">
                Recording: {recordTime} sec
              </div>
            )}
            {uploadError && (
              <div className="mt-2 text-red-500">{uploadError}</div>
            )}
            <div className="mt-4 flex justify-center space-x-2">
              {liveCaptureMode === "image" && (
                <button
                  onClick={captureImage}
                  className="bg-green-500 text-white px-4 py-2 rounded"
                  disabled={isLoading}
                >
                  <FaCamera size={25} />
                </button>
              )}
              {liveCaptureMode === "video" && (
                <>
                  {!isRecording ? (
                    <button
                      onClick={startVideoRecording}
                      className="bg-purple-500 text-white px-4 py-2 rounded"
                      disabled={isLoading}
                    >
                      <FaVideo size={25} />
                    </button>
                  ) : (
                    <button
                      onClick={stopVideoRecording}
                      className="bg-red-500 text-white px-4 py-2 rounded"
                      disabled={isLoading}
                    >
                      <IoMdClose size={25} />
                    </button>
                  )}
                </>
              )}
              {liveCaptureMode === "audio" && (
                <>
                  {!isRecording ? (
                    <button
                      onClick={startAudioRecording}
                      className="bg-orange-500 text-white px-4 py-2 rounded"
                      disabled={isLoading}
                    >
                      <FaMicrophone size={25} />
                    </button>
                  ) : (
                    <button
                      onClick={stopAudioRecording}
                      className="bg-red-500 text-white px-4 py-2 rounded"
                      disabled={isLoading}
                    >
                      <IoMdClose size={25} />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal for Selected Media */}
      {previewUrl && !liveMode && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-4 rounded shadow-lg relative max-w-lg w-full">
            <button
              onClick={reset}
              className="absolute top-0 right-0 m-2 text-red-500 font-bold"
            >
              <IoMdClose size={25} />
            </button>
            {mediaType === "image" && (
              <img src={previewUrl} alt="Preview" className="w-full h-auto" />
            )}
            {mediaType === "video" && (
              <video controls src={previewUrl} className="w-full h-auto" />
            )}
            {(mediaType === "voice" || mediaType === "audio") && (
              <audio controls src={previewUrl} className="w-full" />
            )}
            {mediaType === "file" && (
              <div>
                <p>File selected: {mediaFile.name}</p>
              </div>
            )}
            {uploadProgress > 0 && (
              <div className="mt-2">Upload Progress: {uploadProgress}%</div>
            )}
            {uploadError && (
              <div className="mt-2 text-red-500">{uploadError}</div>
            )}
            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={handleUpload}
                className="bg-blue-500 text-white px-4 py-2 rounded"
              >
                <FaPaperPlane size={18} />
              </button>
              <button
                onClick={reset}
                className="bg-gray-500 text-white px-4 py-2 rounded"
              >
                <IoMdClose size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Action Bar (always visible) */}
      <div className="absolute bottom-14 left-5 p-2 flex flex-wrap gap-2 bg-white border rounded shadow-lg z-10">
        <button onClick={() => startLiveCapture("image")} className="p-1">
          <FaCamera size={20} className="text-green-500" />
        </button>
        <button onClick={() => startLiveCapture("video")} className="p-1">
          <FaVideo size={20} className="text-purple-500" />
        </button>
        <button onClick={() => startLiveCapture("audio")} className="p-1">
          <FaMicrophone size={20} className="text-orange-500" />
        </button>
        <label className="p-1 cursor-pointer">
          <FaFileAlt size={20} className="text-blue-500" />
          <input type="file" onChange={handleFileSelect} className="hidden" />
        </label>
        <button
          onClick={() => setShowEmojiPicker((prev) => !prev)}
          className="p-1"
        >
          <FaSmile size={20} className="text-yellow-500" />
        </button>
      </div>
    </div>
  );
};

export default MultimediaUpload;
