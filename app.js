const express = require('express');
const fs = require('fs');
const path = require('path');
const lockfile = require('proper-lockfile');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 데이터를 파일에서 읽는 함수
function readDataFromFile() {
  if (!fs.existsSync(DATA_FILE)) {
    return []; // 파일이 없다면 빈 배열을 반환
  }
  const data = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(data); // 파일에서 읽은 데이터는 배열임
}

// 데이터를 파일에 쓰는 함수
function writeDataToFile(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// 사용자 정보 업데이트 API
app.post('/update-user/:id', async (req, res) => {
  const { id } = req.params;
  const { name, age } = req.body;

  try {
    // 파일에 락을 걸고 작업을 시작합니다.
    await lockfile.lock(DATA_FILE, {
      realpath: false,
      retries: {
        retries: 5, // 재시도 횟수
        minTimeout: 100, // 재시도 간 최소 대기 시간 (밀리초)
        maxTimeout: 1000, // 재시도 간 최대 대기 시간 (밀리초)
      },
    });

    const data = readDataFromFile(); // 배열을 읽어옴

    const index = data.findIndex((user) => user.id === id); // 수정할 사용자의 인덱스를 찾음

    if (index === -1) {
      await lockfile.unlock(DATA_FILE); // 사용자를 찾지 못한 경우, 작업을 취소하고 락을 해제
      return res.status(404).send({ error: 'User not found' });
    }

    // 사용자 정보 업데이트
    data[index] = { ...data[index], name, age };

    writeDataToFile(data);

    await lockfile.unlock(DATA_FILE); // 작업 완료 후 락을 해제

    res.send({ success: true, user: data[index] });
  } catch (error) {
    await lockfile.unlock(DATA_FILE).catch(() => {});
    res.status(500).send({ error: 'An error occurred' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
