package com.shiftpay.mvp.repository;

import com.shiftpay.mvp.entity.Company;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CompanyRepository extends JpaRepository<Company, Long> {

	Optional<Company> findFirstByName(String name);
}
