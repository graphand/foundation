import { AuthMethods, controllersMap } from "@graphand/core";
import type { AuthControllersMap } from "../types";

const defaultAuthControllersMap: AuthControllersMap = new Map([
  [
    AuthMethods.CODE,
    async (url, client) => {
      const authWindow = window.open(url, "_blank");

      const authResult: {
        accessToken: string;
        refreshToken: string;
      } = await new Promise((resolve, reject) => {
        const _continue = async () => {
          authWindow.close();
          window.removeEventListener("focus", _continue);
          const code = window.prompt("Code");
          if (!code) {
            resolve(null);
          }

          try {
            const res = await client.executeController(
              controllersMap.codeAuth,
              {
                body: { code },
              }
            );

            resolve(res);
          } catch (e) {
            reject(e);
          }
        };

        window.addEventListener("focus", _continue);
      });

      return authResult;
    },
  ],
  [
    AuthMethods.REDIRECT,
    (url) => {
      window.location.href = url;
      console.warn("Redirecting to auth url... You can ignore this error");
      throw new Error();
    },
  ],
  [
    AuthMethods.WINDOW,
    async (url) => {
      const authWindow = window.open(url, "_blank");

      // Create a Promise to wait for the authentication result (e.g., using postMessage)
      const authResult: {
        accessToken: string;
        refreshToken: string;
      } = await new Promise((resolve, reject) => {
        window.addEventListener("message", (event) => {
          if (event.data.type === "authResult") {
            authWindow.close();
            resolve(event.data.authResult);
          }
        });

        // Set a timeout to handle errors or user closing the window
        setTimeout(() => {
          reject(new Error("Login timed out"));
        }, 300000); // 5 minutes
      });

      return authResult;
    },
  ],
]);

export default defaultAuthControllersMap;
