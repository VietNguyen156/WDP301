import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, ArrowUpRight } from "lucide-react";
import { contractApi, branchApi } from "../../services/api";
import { useResource, useDebounced } from "../../hooks/useResource";
import { useAuth } from "../../context/AuthContext";
import {
  Badge,
  Button,
  PageHeader,
  SearchBox,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
} from "../../components/ui";
import { money, date, labels } from "../../utils/format";
import ContractForm from "./ContractForm";
import ContractDetail from "./ContractDetail";
export default function ContractsPage() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth(),
    landlord = user.role === "LANDLORD";
  const [creating, setCreating] = useState(
      params.get("create") === "1" && landlord,
    ),
    [selected, setSelected] = useState(null);
  const [status, setStatus] = useState(""),
    [branchId, setBranchId] = useState(""),
    [page, setPage] = useState(1),
    [search, setSearch] = useState("");
  const debounced = useDebounced(search);
  const branches = useResource(
    () => (landlord ? branchApi.options() : Promise.resolve([])),
    [landlord],
  );
  const resource = useResource(
    () => contractApi.list({ status, branchId, page, search: debounced }),
    [status, branchId, page, debounced],
  );
  function closeCreate() {
    setCreating(false);
    setParams({});
  }
  return (
    <>
      <PageHeader
        title={landlord ? "Quản lý hợp đồng" : "Hợp đồng của tôi"}
        description="Theo dõi thời hạn thuê, thông tin cư dân và biên bản bàn giao."
        action={
          landlord && (
            <Button onClick={() => setCreating(true)}>
              <Plus size={18} />
              Tạo hợp đồng
            </Button>
          )
        }
      />
      <div className="filter-tabs">
        {["", "ACTIVE", "EXPIRING_SOON", "EXPIRED", "TERMINATED"].map((s) => (
          <button
            key={s}
            className={status === s ? "active" : ""}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
          >
            {s ? labels[s] : "Tất cả hợp đồng"}
          </button>
        ))}
      </div>
      <div className="toolbar">
        <SearchBox
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Tìm mã hợp đồng…"
        />
        {landlord && (
          <select
            aria-label="Lọc theo cơ sở"
            value={branchId}
            onChange={(e) => {
              setBranchId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Tất cả cơ sở</option>
            {branches.data?.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
      </div>
      {branches.error && (
        <ErrorState message={branches.error} retry={branches.reload} />
      )}
      {resource.loading ? (
        <LoadingState />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : !resource.data.items.length ? (
        <EmptyState
          title="Chưa có hợp đồng phù hợp"
          description="Hồ sơ thuê phòng sẽ được lưu tại đây khi bạn lập hợp đồng mới."
          action={
            landlord && (
              <Button onClick={() => setCreating(true)}>
                <Plus size={17} />
                Tạo hợp đồng
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="table-wrap contracts-table">
            <table>
              <thead>
                <tr>
                  <th>Hợp đồng / Phòng</th>
                  <th>Khách thuê</th>
                  <th>Thời hạn</th>
                  <th>Giá thuê & cọc</th>
                  <th>Trạng thái</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {resource.data.items.map((c) => (
                  <tr key={c._id} onClick={() => setSelected(c._id)}>
                    <td data-label="Hợp đồng">
                      <strong>
                        {c.roomId?.roomNumber || "Phòng đã lưu trữ"}
                      </strong>
                      <small>{c.branchId?.name || "Cơ sở đã lưu trữ"}</small>
                      <small className="code-text">{c.contractCode}</small>
                    </td>
                    <td data-label="Khách thuê">
                      <div className="person-cell">
                        <div className="person-avatar">
                          {c.tenantId?.name?.slice(0, 1) || "?"}
                        </div>
                        <div>
                          <strong>
                            {c.tenantId?.name || "Khách đã lưu trữ"}
                          </strong>
                          <small>{c.tenantId?.phoneNumber || "—"}</small>
                        </div>
                      </div>
                    </td>
                    <td data-label="Thời hạn">
                      <span>{date(c.startDate)}</span>
                      <small>đến {date(c.endDate)}</small>
                    </td>
                    <td data-label="Giá thuê">
                      <strong>{money(c.rentalPrice)}</strong>
                      <small>Cọc {money(c.depositAmount)}</small>
                    </td>
                    <td data-label="Trạng thái">
                      <Badge status={c.displayStatus} />
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Xem hợp đồng ${c.contractCode}`}
                        onClick={() => setSelected(c._id)}
                      >
                        <ArrowUpRight size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...resource.data} onChange={setPage} />
        </>
      )}
      {creating && (
        <ContractForm
          branchId={params.get("branchId") || ""}
          roomId={params.get("roomId") || ""}
          onClose={closeCreate}
          onSaved={() => {
            closeCreate();
            resource.reload();
          }}
        />
      )}
      {selected && (
        <ContractDetail
          id={selected}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            resource.reload();
          }}
        />
      )}
    </>
  );
}
