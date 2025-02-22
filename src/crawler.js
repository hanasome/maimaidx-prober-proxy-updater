import { useStage, useTrace } from "./trace.js";

import { CookieJar } from "node-fetch-cookies";
import config from "../config.js";
import fetch from "node-fetch";
import { fetchWithCookieWithRetry } from "./util.js";

async function verifyProberAccount(username, password) {
  const res = await fetch(
    "https://www.diving-fish.com/api/maimaidxprober/login",
    {
      method: "post",
      headers: {
        Host: "www.diving-fish.com",
        Origin: "https://www.diving-fish.com",
        Referer: "https://www.diving-fish.com/maimaidx/prober/",
        "Content-Type": "application/json;charset=UTF-8",
      },
      body: JSON.stringify({ username, password }),
    }
  );
  const data = await res.json();
  console.log(data);
  return data.errcode == undefined;
}

async function getAuthUrl(type) {
  if (!["maimai-dx", "chunithm"].includes(type)) {
    throw new Error("unsupported type");
  }

  const res = await fetch(
    `https://tgk-wcaime.wahlap.com/wc_auth/oauth/authorize/${type}`
  );
  const href = res.url.replace("redirect_uri=https", "redirect_uri=http");
  console.log(href);
  return href;
}

const getCookieByAuthUrl = async (authUrl) => {
  const cj = new CookieJar();
  const fetch = async (url, options) =>
    await fetchWithCookieWithRetry(cj, url, options);
  await fetch(authUrl, {
    headers: {
      Host: "tgk-wcaime.wahlap.com",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Safari/537.36 NetType/WIFI MicroMessenger/7.0.20.1781(0x6700143B) WindowsWechat(0x6307001e)",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-User": "?1",
      "Sec-Fetch-Dest": "document",
      "Accept-Encoding": "gzip, deflate, br",
      "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
    },
  });

  await fetch("https://maimai.wahlap.com/maimai-mobile/home/");

  return cj;
};

const updateMaimaiScore = async (
  username,
  password,
  authUrl,
  traceUUID,
  allDiff,
  logCreatedCallback
) => {
  try {
    const trace = useTrace(traceUUID);
    const stage = useStage(trace);

    const cj = new CookieJar();

    const fetch = async (url, options) =>
      await fetchWithCookieWithRetry(cj, url, options);

    await trace({
      log: "开始更新 maimai 成绩",
      status: "running",
      progress: 0,
    });

    logCreatedCallback();

    await stage("登录公众号", 10, async () => {
      await fetch(authUrl, {
        headers: {
          Host: "tgk-wcaime.wahlap.com",
          Connection: "keep-alive",
          "Upgrade-Insecure-Requests": "1",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Safari/537.36 NetType/WIFI MicroMessenger/7.0.20.1781(0x6700143B) WindowsWechat(0x6307001e)",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-User": "?1",
          "Sec-Fetch-Dest": "document",
          "Accept-Encoding": "gzip, deflate, br",
          "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
        },
      });

      const result = await fetch(
        "https://maimai.wahlap.com/maimai-mobile/home/"
      );
      const body = await result.text();

      if (body.match("错误")) {
        throw new Error("登录公众号时出现错误");
      }
    });

    const descriptions = ["Basic", "Advanced", "Expert", "Master", "Re:Master"];
    const tasks = [];
    for (let diff = 0; diff < 5; diff++) {
      const progress = 9;
      const task = stage(`更新 ${descriptions[diff]} 难度分数`, 0, async () => {
        if (!allDiff && diff <= 1) {
          // await setTimeout(() => {}, 1000 * (diff + 1));
          await trace({
            log: `难度 ${descriptions[diff]} 更新已跳过`,
            progress: progress * 2,
          });
          return;
        }

        let body = undefined;

        await stage(`获取 ${descriptions[diff]} 分数`, progress, async () => {
          const result = await fetch(
            `https://maimai.wahlap.com/maimai-mobile/record/musicGenre/search/?genre=99&diff=${diff}`
          );
          body = (await result.text())
            .match(/<html.*>([\s\S]*)<\/html>/)[1]
            .replace(/\s+/g, " ");
        });

        await stage(
          `上传 ${descriptions[diff]} 分数至 diving-fish 查分器数据库`,
          progress,
          async () => {
            const uploadResult = await fetch(`${config.pageParserHost}/page`, {
              method: "post",
              headers: { "content-type": "text/plain" },
              body: `<login><u>${username}</u><p>${password}</p></login>${body}`,
            });

            const log = `diving-fish 上传 ${
              descriptions[diff]
            } 分数接口返回消息: ${await uploadResult.text()}`;
            await trace({ log });
          }
        );
      });
      tasks.push(task);
    }

    await Promise.all(tasks);

    await trace({
      log: "maimai 数据更新完成",
      process: 0,
      status: "success",
    });
  } catch (err) {
    console.log(err);
  }
};

const updateChunithmScore = async (
  username,
  password,
  authUrl,
  traceUUID,
  allDiff,
  logCreatedCallback
) => {
  try {
    const trace = useTrace(traceUUID);
    const stage = useStage(trace);
    const cj = new CookieJar();
    const fetch = async (url, options) =>
      await fetchWithCookieWithRetry(cj, url, options);

    await trace({
      log: "开始更新 chunithm 成绩",
      status: "running",
      progress: 0,
    });

    logCreatedCallback();

    await stage("登录公众号", 6.25, async () => {
      const authResult = await fetch(authUrl, {
        headers: {
          Connection: "keep-alive",
          "Upgrade-Insecure-Requests": "1",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Safari/537.36 NetType/WIFI MicroMessenger/7.0.20.1781(0x6700143B) WindowsWechat(0x6307001e)",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-User": "?1",
          "Sec-Fetch-Dest": "document",
          "Accept-Encoding": "gzip, deflate, br",
          "Accept-Language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
        },
      });

      const body = await authResult.text();
      if (body.match("错误码")) {
        throw new Error("登陆公众号时存在错误码");
      }

      const loginResult = await fetch(
        "https://www.diving-fish.com/api/maimaidxprober/login",
        {
          method: "POST",
          body: JSON.stringify({ username, password }),
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      if (loginResult.status === 401) {
        throw new Error("登录 http 请求状态码为 401");
      }
    });

    const urls = [
      ["/record/musicGenre/sendBasic", "/record/musicGenre/basic"],
      ["/record/musicGenre/sendAdvanced", "/record/musicGenre/advanced"],
      ["/record/musicGenre/sendExpert", "/record/musicGenre/expert"],
      ["/record/musicGenre/sendMaster", "/record/musicGenre/master"],
      ["/record/musicGenre/sendUltima", "/record/musicGenre/ultima"],
      [null, "/record/worldsEndList/"],
      [null, "/home/playerData/ratingDetailRecent/"],
    ];

    const descriptions = [
      "Basic",
      "Advanced",
      "Expert",
      "Master",
      "Ultima",
      "WorldsEnd",
      "最近游玩",
    ];

    const _t = cj.cookies.get("chunithm.wahlap.com").get("_t").value;

    const tasks = [];
    for (let i = 0; i < 7; i++) {
      const url = urls[i];
      const task = stage(`更新 ${descriptions[i]} 分数`, 0, async () => {
        if (!allDiff && i <= 1) {
          await trace({
            log: `难度 ${descriptions[i]} 更新已跳过`,
            progress: 6.25 * 2,
          });
          return;
        }

        let resultHtml = undefined;

        await stage(`获取 ${descriptions[i]} 分数`, 6.25, async () => {
          if (url[0]) {
            await fetch("https://chunithm.wahlap.com/mobile" + url[0], {
              method: "POST",
              body: `genre=99&token=${_t}`,
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
            });
          }

          const result = await fetch(
            "https://chunithm.wahlap.com/mobile" + url[1]
          );
          resultHtml = await result.text();
        });

        await stage(
          `上传 ${descriptions[i]} 分数至 diving-fish 查分器数据库`,
          6.25,
          async () => {
            const uploadResult = await fetch(
              "https://www.diving-fish.com/api/chunithmprober/player/update_records_html" +
                (url[1].includes("Recent") ? "?recent=1" : ""),
              {
                method: "POST",
                body: resultHtml,
              }
            );

            const log = `diving-fish 上传 ${
              descriptions[i]
            } 分数接口返回消息: ${await uploadResult.text()}`;
            await trace({ log });
          }
        );
      });
      tasks.push(task);
    }

    await Promise.all(tasks);

    await trace({
      log: "chunithm 数据更新完成",
      progress: 6.25,
      status: "success",
    });
  } catch (err) {
    console.log(err);
  }
};

export {
  verifyProberAccount,
  updateMaimaiScore,
  updateChunithmScore,
  getAuthUrl,
  getCookieByAuthUrl,
};
